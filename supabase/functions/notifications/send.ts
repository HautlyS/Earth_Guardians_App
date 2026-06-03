/**
 * Send Notification Edge Function
 * Earth Guardians Platform
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth } from '../_shared/cors.ts'

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

    const { recipient_ids, title, body, type = 'general', data = {}, channel = 'in_app' } = await req.json()

    if (!recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
      return errorResponse('recipient_ids array is required', 400)
    }

    if (!title) {
      return errorResponse('title is required', 400)
    }

    // Get notification preferences for recipients
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', recipient_ids)

    // Create notifications based on preferences
    const notifications = []
    
    for (const recipientId of recipient_ids) {
      const pref = prefs?.find(p => p.user_id === recipientId)
      
      // Check if this notification type is enabled for the channel
      const prefKey = `${channel}_on_${type}`
      const enabled = pref?.[prefKey] !== false // Default to true if not set

      if (enabled) {
        notifications.push({
          user_id: recipientId,
          title,
          body: body || null,
          type,
          data,
          is_read: false,
          created_at: new Date().toISOString()
        })
      }
    }

    if (notifications.length === 0) {
      return successResponse({
        success: true,
        notifications_created: 0,
        message: 'All recipients have this notification type disabled'
      })
    }

    const { data: created, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select()

    if (insertError) throw insertError

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'notification_sent',
      entity_type: 'notification',
      metadata: { 
        recipient_count: recipient_ids.length,
        type,
        channel
      }
    })

    return successResponse({
      success: true,
      notifications_created: created?.length || 0,
      total_recipients: recipient_ids.length
    })

  } catch (error) {
    console.error('Send notification error:', error)
    return errorResponse(error.message || 'Failed to send notification')
  }
})