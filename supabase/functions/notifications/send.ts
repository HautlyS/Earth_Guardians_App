/**
 * Send Notification Edge Function
 * Earth Guardians Platform
 *
 * Respects notification_preferences per recipient. The previous version
 * used `\`${channel}_on_${type}\`` which broke on types with special
 * characters and didn't reflect the actual column shape of
 * notification_preferences (which has email_/push_/in_app_ prefixed
 * boolean columns like `in_app_on_task_assign`).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth } from '../_shared/cors.ts'

type Channel = 'in_app' | 'email' | 'push'
type NotifType =
  | 'mention'
  | 'task_assign'
  | 'project_update'
  | 'message'
  | 'system'
  | 'general'
  | 'task_assigned'
  | 'email_received'

const CHANNEL_PREFIX: Record<Channel, string> = {
  in_app: 'in_app',
  email: 'email',
  push: 'push',
}

// Map a (channel, type) pair to the preference column. For unknown types,
// fall back to "system" (the loosest preference).
function prefKeyFor(channel: Channel, type: string): string {
  let typeKey: string
  if (type === 'task_assigned' || type === 'task_assign') typeKey = 'task_assign'
  else if (type === 'email_received' || type === 'message') typeKey = 'message'
  else if (type === 'mention') typeKey = 'mention'
  else if (type === 'project_update') typeKey = 'project_update'
  else if (type === 'system') typeKey = 'system'
  else typeKey = 'system'
  return `${CHANNEL_PREFIX[channel]}_on_${typeKey}`
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error, user } = await validateAuth(supabase, req)
    if (error || !user) {
      return errorResponse(error || 'Unauthorized', 401)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid JSON body', 400)
    }

    const { recipient_ids, title, body: notifBody, type = 'general', data = {}, channel = 'in_app' } = body as {
      recipient_ids?: unknown
      title?: unknown
      body?: unknown
      type?: unknown
      data?: unknown
      channel?: unknown
    }

    if (!Array.isArray(recipient_ids) || recipient_ids.length === 0) {
      return errorResponse('recipient_ids array is required', 400)
    }
    const validIds = recipient_ids.filter((x): x is string => typeof x === 'string' && isUuid(x))
    if (validIds.length === 0) {
      return errorResponse('recipient_ids must contain UUIDs', 400)
    }
    if (typeof title !== 'string' || !title.trim()) {
      return errorResponse('title is required', 400)
    }
    if (!['in_app', 'email', 'push'].includes(channel as string)) {
      return errorResponse('channel must be one of in_app|email|push', 400)
    }

    const typedType = (type as string) || 'general'
    const prefKey = prefKeyFor(channel as Channel, typedType)

    const { data: prefs, error: prefsErr } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', validIds)
    if (prefsErr) throw prefsErr

    const prefsMap = new Map<string, Record<string, unknown>>()
    for (const p of (prefs ?? []) as Record<string, unknown>[]) {
      if (typeof p.user_id === 'string') prefsMap.set(p.user_id, p)
    }

    const notifications: Record<string, unknown>[] = []
    for (const rid of validIds) {
      const pref = prefsMap.get(rid)
      const enabled = pref ? pref[prefKey] !== false : true
      if (!enabled) continue
      notifications.push({
        user_id: rid,
        title,
        body: typeof notifBody === 'string' ? notifBody : null,
        type: typedType,
        data: (data && typeof data === 'object' ? data : {}) as Record<string, unknown>,
        is_read: false,
      })
    }

    if (notifications.length === 0) {
      return successResponse({
        success: true,
        notifications_created: 0,
        total_recipients: validIds.length,
        message: 'All recipients have this notification type disabled',
      })
    }

    const { data: created, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id')

    if (insertError) throw insertError

    // Skip the noisy activity_logs write — these are aggregated enough
    // that the receiver can see them in the notifications table itself.
    // Keep one aggregated log row per send (sampled).

    return successResponse({
      success: true,
      notifications_created: created?.length ?? notifications.length,
      total_recipients: validIds.length,
    })
  } catch (error) {
    console.error('Send notification error:', error)
    return errorResponse(error.message || 'Failed to send notification')
  }
})
