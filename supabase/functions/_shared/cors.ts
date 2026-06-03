/**
 * Shared Edge Function Utilities
 * Earth Guardians Platform
 */

// CORS headers for all edge functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to create error response
export function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Helper to create success response
export function successResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Validate authorization header
export async function validateAuth(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader) {
    return { error: 'Missing authorization header', user: null }
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(authHeader)
    
    if (error || !user) {
      return { error: 'Invalid or expired token', user: null }
    }
    
    return { error: null, user }
  } catch (e) {
    return { error: 'Authentication failed', user: null }
  }
}

// Parse JSON body safely
export async function parseBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch {
    throw new Error('Invalid JSON body')
  }
}

// Get pagination params from URL
export function getPaginationParams(url: URL) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0')
  return { limit, offset }
}

// Generate a unique token
export function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Log activity helper
export async function logActivity(
  supabase: any,
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, any>
) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata || {}
    })
  } catch (e) {
    console.error('Failed to log activity:', e)
  }
}