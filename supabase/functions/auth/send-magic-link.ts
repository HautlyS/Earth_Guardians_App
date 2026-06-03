/**
 * Send Magic Link Edge Function — DEPRECATED
 *
 * Earth Guardians Platform now uses Supabase's native `signInWithOtp` flow
 * (see `apps/web/src/stores/auth.ts` → `signInWithEmail`).
 *
 * This function is kept for backwards compatibility but always returns
 * 410 Gone with a clear migration message.
 *
 * For new sign-ins, the client calls:
 *   supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })
 * which dispatches Supabase's own email template and handles verification
 * server-side — no custom token table required.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, errorResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      error: 'Deprecated',
      code: 'use_supabase_otp',
      message:
        'Custom magic-link flow is deprecated. Use supabase.auth.signInWithOtp() on the client. ' +
        'See apps/web/src/stores/auth.ts.',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})

// Suppress unused-import lint warnings; kept for shared utility continuity.
export const _ = errorResponse
