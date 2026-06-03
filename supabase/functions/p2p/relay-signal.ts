/**
 * P2P Relay Signal Edge Function
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

    const { to_peer_id, signal_type, payload } = await req.json()

    // Validate required fields
    if (!to_peer_id || !signal_type || !payload) {
      return errorResponse('to_peer_id, signal_type, and payload are required', 400)
    }

    // Validate signal type
    const validTypes = ['offer', 'answer', 'ice-candidate', 'leave']
    if (!validTypes.includes(signal_type)) {
      return errorResponse(`Invalid signal_type. Must be one of: ${validTypes.join(', ')}`, 400)
    }

    // Get receiver's peer info
    const { data: receiverPeer } = await supabase
      .from('p2p_peers')
      .select('id, user_id, is_online')
      .eq('user_id', to_peer_id)
      .single()

    // Get sender's peer info
    const { data: senderPeer } = await supabase
      .from('p2p_peers')
      .select('peer_id')
      .eq('user_id', user.id)
      .single()

    // Store signal in database
    const { data: signal, error: signalError } = await supabase
      .from('p2p_signaling')
      .insert({
        from_peer_id: user.id,
        to_peer_id,
        signal_type,
        payload
      })
      .select()
      .single()

    if (signalError) throw signalError

    // If receiver is online, attempt to broadcast via Realtime
    // Note: In production, you'd use Supabase Realtime presence/broadcast here
    const isDelivered = receiverPeer?.is_online || false

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'p2p_signal_sent',
      entity_type: 'p2p_signal',
      entity_id: signal.id,
      metadata: { to_peer_id, signal_type, delivered: isDelivered }
    })

    return successResponse({
      success: true,
      signal_id: signal.id,
      delivered: isDelivered,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Relay signal error:', error)
    return errorResponse(error.message || 'Failed to relay signal')
  }
})