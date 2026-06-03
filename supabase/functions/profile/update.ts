/**
 * Update Profile Edge Function
 * Earth Guardians Platform
 *
 * Strips protected fields (id, user_id, role, created_at) so callers
 * cannot escalate their own role via this endpoint. Server-side
 * admins use the Supabase service role directly.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth, logActivity } from '../_shared/cors.ts'

const PROTECTED_FIELDS = ['id', 'user_id', 'role', 'created_at'] as const

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

    // Strip protected fields
    for (const field of PROTECTED_FIELDS) {
      if (field in body) delete (body as Record<string, unknown>)[field]
    }

    const updates = body as Record<string, unknown>

    // Validate username uniqueness if updating
    if (typeof updates.username === 'string') {
      const desired = updates.username.trim()
      if (desired.length < 3 || desired.length > 30) {
        return errorResponse('Username must be 3-30 characters', 400)
      }
      if (!/^[a-z0-9_]+$/i.test(desired)) {
        return errorResponse('Username may only contain letters, numbers, and underscores', 400)
      }
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', desired)
        .neq('user_id', user.id)
        .maybeSingle()
      if (existing) {
        return errorResponse('Username already taken', 409)
      }
      updates.username = desired
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No updatable fields provided', 400)
    }

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) throw updateError

    await logActivity(supabase, user.id, 'profile_updated', 'profile', profile.id, {
      updated_fields: Object.keys(updates),
    })

    return successResponse({ success: true, profile })
  } catch (error) {
    console.error('Update profile error:', error)
    return errorResponse(error.message || 'Failed to update profile')
  }
})
