/**
 * Verify Magic Link Token Edge Function — DEPRECATED
 *
 * The legacy flow created a custom session row that the client never
 * received. Supabase's OTP flow is the supported sign-in path now.
 *
 * This function returns 410 Gone for any new request and instructs the
 * client to use `supabase.auth.verifyOtp` or `exchangeCodeForSession`
 * via `/auth/callback`.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      error: 'Deprecated',
      code: 'use_supabase_callback',
      message:
        'Custom token verification is deprecated. The client should call ' +
        'supabase.auth.verifyOtp() or supabase.auth.exchangeCodeForSession() ' +
        'from /auth/callback when Supabase redirects back with ?code= or ?token_hash=.',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
