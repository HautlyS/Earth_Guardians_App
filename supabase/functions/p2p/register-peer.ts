/**
 * Register P2P Peer Edge Function
 * Earth Guardians Platform
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth, generateToken } from '../_shared/cors.ts'

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

    const { peer_id, public_key, connection_info } = await req.json()

    if (!peer_id) {
      return errorResponse('peer_id is required', 400)
    }

    // Upsert peer record
    const { data: peer, error: peerError } = await supabase
      .from('p2p_peers')
      .upsert({
        user_id: user.id,
        peer_id,
        public_key: public_key || null,
        connection_info: connection_info || {},
        is_online: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (peerError) throw peerError

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'peer_registered',
      entity_type: 'p2p_peer',
      entity_id: peer.id,
      metadata: { peer_id }
    })

    // Get connected peers
    const { data: connectedPeers } = await supabase
      .from('p2p_peers')
      .select('user_id, peer_id, public_key, last_seen_at')
      .eq('is_online', true)
      .neq('user_id', user.id)
      .limit(50)

    return successResponse({
      success: true,
      peer_id: peer.peer_id,
      peer_record_id: peer.id,
      online_peers: connectedPeers || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Register peer error:', error)
    return errorResponse(error.message || 'Failed to register peer')
  }
})