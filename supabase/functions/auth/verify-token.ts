/**
 * Verify Magic Link Token Edge Function
 * Earth Guardians Platform
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, generateToken } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { token, email } = await req.json()

    if (!token) {
      return errorResponse('Token is required', 400)
    }

    // Verify token
    const { data: tokenData, error: tokenError } = await supabase
      .from('auth_tokens')
      .select('*, profiles(*)')
      .eq('token', token)
      .eq('type', 'magic_link')
      .eq('status', 'pending')
      .single()

    if (tokenError || !tokenData) {
      return errorResponse('Invalid or expired token', 401)
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      await supabase
        .from('auth_tokens')
        .update({ status: 'expired' })
        .eq('id', tokenData.id)
      
      return errorResponse('Token has expired', 401)
    }

    // Mark token as used
    await supabase
      .from('auth_tokens')
      .update({ 
        status: 'used',
        used_at: new Date().toISOString()
      })
      .eq('id', tokenData.id)

    // Get user profile
    const profile = tokenData.profiles

    // Generate new session token (simplified - use Supabase Auth in production)
    const sessionToken = generateToken()
    const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create session
    await supabase.from('auth_tokens').insert({
      user_id: profile?.user_id,
      token: sessionToken,
      type: 'session',
      expires_at: sessionExpires.toISOString()
    })

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: profile?.user_id,
      action: 'magic_link_verified',
      entity_type: 'auth',
      metadata: { email }
    })

    return successResponse({
      success: true,
      user: profile ? {
        id: profile.user_id,
        email: profile.email,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role
      } : null,
      session: {
        token: sessionToken,
        expires_at: sessionExpires.toISOString()
      }
    })

  } catch (error) {
    console.error('Verify token error:', error)
    return errorResponse(error.message || 'Failed to verify token')
  }
})