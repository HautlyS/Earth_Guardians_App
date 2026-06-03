/**
 * Earth Guardians - Email 2.0 Send Edge Function
 *
 * Sends an internal email: inserts into email_messages and email_recipients,
 * then writes a notification row for each recipient.
 *
 * Required: migration 007 added body_html, has_attachments, attachments,
 * preview, folder, updated_at to email_messages.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendBody {
  recipients: { id: string; type?: 'to' | 'cc' | 'bcc' }[]
  subject: string
  body: string
  body_html?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  attachments?: { name: string; size: number; mime: string; url: string }[]
  folder?: 'sent' | 'drafts'
  preview?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
    const { data: userData, error: authErr } = await supabase.auth.getUser(authHeader)
    if (authErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const user = userData.user

    const payload = (await req.json().catch(() => null)) as Partial<SendBody> | null
    if (!payload) return json({ error: 'Invalid JSON body' }, 400)

    const recipients = Array.isArray(payload.recipients) ? payload.recipients : []
    const validRecipients = recipients.filter(
      (r): r is { id: string; type?: 'to' | 'cc' | 'bcc' } =>
        !!r && typeof r.id === 'string' && isUuid(r.id) && r.id !== user.id
    )
    if (validRecipients.length === 0) {
      return json({ error: 'At least one valid recipient is required' }, 400)
    }
    if (typeof payload.subject !== 'string' || !payload.subject.trim()) {
      return json({ error: 'subject is required' }, 400)
    }
    if (typeof payload.body !== 'string' || !payload.body.trim()) {
      return json({ error: 'body is required' }, 400)
    }

    const attachments = Array.isArray(payload.attachments) ? payload.attachments : []
    const preview = payload.preview ?? payload.body.slice(0, 140)

    const { data: message, error: messageError } = await supabase
      .from('email_messages')
      .insert({
        sender_id: user.id,
        subject: payload.subject.trim(),
        body: payload.body,
        body_html: payload.body_html ?? null,
        priority: payload.priority ?? 'normal',
        has_attachments: attachments.length > 0,
        attachments,
        preview,
        folder: payload.folder ?? 'sent',
        is_read: false,
        is_starred: false,
        is_archived: false,
        is_deleted: false,
      })
      .select()
      .single()

    if (messageError) throw messageError

    const recipientRows = validRecipients.map((r) => ({
      message_id: message.id,
      recipient_id: r.id,
      recipient_type: r.type ?? 'to',
    }))
    const { error: recipientsErr } = await supabase.from('email_recipients').insert(recipientRows)
    if (recipientsErr) throw recipientsErr

    const notifications = validRecipients.map((r) => ({
      user_id: r.id,
      type: 'email_received',
      title: `New email from ${user.email ?? 'someone'}`,
      body: payload.subject,
      data: { message_id: message.id, from: user.id },
    }))
    await supabase.from('notifications').insert(notifications)

    return json({ success: true, message, recipient_count: validRecipients.length })
  } catch (error) {
    console.error('email/send error:', error)
    return json({ error: error instanceof Error ? error.message : 'Failed to send' }, 500)
  }
})
