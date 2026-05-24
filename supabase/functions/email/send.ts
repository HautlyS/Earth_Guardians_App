/**
 * Earth Guardians - Email 2.0 Edge Function
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabase.auth.getUser(authHeader);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { recipients, subject, body, bodyHtml, priority, attachments } = await req.json();

    const { data: message, error: messageError } = await supabase
      .from('email_messages')
      .insert({ sender_id: user.id, subject, body, body_html: bodyHtml, priority: priority || 'normal', has_attachments: attachments?.length > 0, attachments: attachments || [] })
      .select()
      .single();

    if (messageError) throw messageError;

    await supabase.from('email_recipients').insert(recipients.map((r: { id: string; type?: string }) => ({
      message_id: message.id, recipient_id: r.id, recipient_type: r.type || 'to',
    })));

    for (const recipient of recipients) {
      await supabase.from('notifications').insert({
        user_id: recipient.id, type: 'email_received', title: `New email from ${user.email}`, body: subject, data: { message_id: message.id },
      });
    }

    return new Response(JSON.stringify({ success: true, message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
