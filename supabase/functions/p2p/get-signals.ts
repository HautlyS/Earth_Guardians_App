/**
 * Get Pending Signals Edge Function
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

    // Get pending signals for this user
    const { data: signals, error: signalsError } = await supabase
      .from('p2p_signaling')
      .select(`
        id,
        from_peer_id,
        signal_type,
        payload,
        created_at
      `)
      .eq('to_peer_id', user.id)
      .eq('is_delivered', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(50)

    if (signalsError) throw signalsError

    // Mark signals as delivered
    if (signals && signals.length > 0) {
      const signalIds = signals.map(s => s.id)
      await supabase
        .from('p2p_signaling')
        .update({ 
          is_delivered: true,
          delivered_at: new Date().toISOString()
        })
        .in('id', signalIds)
    }

    // Get sender profiles
    const senderIds = [...new Set(signals?.map(s => s.from_peer_id) || [])]
    const { data: senderProfiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_url')
      .in('user_id', senderIds)

    const profilesMap = new Map(senderProfiles?.map(p => [p.user_id, p]) || [])

    // Enrich signals with sender info
    const enrichedSignals = signals?.map(signal => ({
      ...signal,
      sender: profilesMap.get(signal.from_peer_id)
    })) || []

    return successResponse({
      signals: enrichedSignals,
      count: enrichedSignals.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Get signals error:', error)
    return errorResponse(error.message || 'Failed to get signals')
  }
})