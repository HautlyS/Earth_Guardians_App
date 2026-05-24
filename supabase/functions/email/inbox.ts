/**
 * Earth Guardians - Email 2.0 Inbox Edge Function
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const folder = url.searchParams.get('folder') || 'inbox';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabase.auth.getUser(authHeader);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let query = supabase.from('email_messages').select(`
      id, subject, body, priority, has_attachments, attachments, is_read, is_starred, is_archived, is_deleted, created_at,
      sender:profiles!sender_id(id, username, display_name, avatar_url),
      recipients(email_recipients!inner(id, recipient_id, is_read, is_archived, is_deleted, recipient_type))
    `).order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    if (folder === 'inbox') {
      query = query.not('is_deleted', 'eq', true).not('sender_id', 'eq', user.id);
    } else if (folder === 'sent') {
      query = query.eq('sender_id', user.id).not('is_deleted', 'eq', true);
    } else if (folder === 'archive') {
      query = query.eq('is_archived', true);
    } else if (folder === 'spam') {
      query = query.eq('is_deleted', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ messages: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
