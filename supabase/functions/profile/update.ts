/**
 * Update Profile Edge Function
 * Earth Guardians Platform
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth, logActivity } from '../_shared/cors.ts'

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

    const updates = await req.json()

    // Remove protected fields
    delete updates.id
    delete updates.user_id
    delete updates.created_at

    // Validate username uniqueness if updating
    if (updates.username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', updates.username)
        .neq('user_id', user.id)
        .single()

      if (existing) {
        return errorResponse('Username already taken', 409)
      }
    }

    // Update profile
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) throw updateError

    // Log activity
    await logActivity(supabase, user.id, 'profile_updated', 'profile', profile.id, {
      updated_fields: Object.keys(updates)
    })

    return successResponse({
      success: true,
      profile
    })

  } catch (error) {
    console.error('Update profile error:', error)
    return errorResponse(error.message || 'Failed to update profile')
  }
})