/**
 * Earth Guardians - Email 2.0 Inbox Edge Function
 *
 * Returns messages for a folder. Uses PostgREST idiomatic operators
 * (.eq / .neq) rather than the .not('col','eq',val) form which is
 * confusing and not portable across Supabase versions.
 *
 * Required: migration 007 added body_html, has_attachments, attachments,
 * preview, folder to email_messages.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Folder = 'inbox' | 'sent' | 'starred' | 'archive' | 'trash' | 'drafts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isFolder(s: string | null): s is Folder {
  return s === 'inbox' || s === 'sent' || s === 'starred' || s === 'archive' || s === 'trash' || s === 'drafts'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
    const { data: userData, error: authErr } = await supabase.auth.getUser(authHeader)
    if (authErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const user = userData.user

    const url = new URL(req.url)
    const folderParam = url.searchParams.get('folder') || 'inbox'
    const folder: Folder = isFolder(folderParam) ? folderParam : 'inbox'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0)

    // Two-phase query:
    //   1) For inbox/starred/archive/trash, find message ids via email_recipients
    //   2) Fetch the messages and join sender profile
    // For 'sent', use sender_id directly.
    let messageIds: string[] | null = null
    if (folder === 'inbox' || folder === 'starred' || folder === 'archive' || folder === 'trash') {
      let rq = supabase
        .from('email_recipients')
        .select('message_id')
        .eq('recipient_id', user.id)
      if (folder === 'trash') {
        rq = rq.eq('is_deleted', true)
      } else {
        rq = rq.eq('is_deleted', false)
        if (folder === 'archive') rq = rq.eq('is_archived', true)
      }
      const { data: rs, error: rErr } = await rq
      if (rErr) throw rErr
      messageIds = (rs ?? []).map((r) => (r as { message_id: string }).message_id)
      if (messageIds.length === 0) return json({ messages: [], count: 0 })
    }

    let mq = supabase
      .from('email_messages')
      .select(
        'id, sender_id, subject, body, body_html, preview, priority, has_attachments, attachments, is_read, is_starred, is_archived, is_deleted, folder, created_at, updated_at, sender:profiles!sender_id(id, username, display_name, avatar_url)'
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (folder === 'sent' || folder === 'drafts') {
      mq = mq.eq('sender_id', user.id).eq('is_deleted', false)
      if (folder === 'drafts') mq = mq.eq('folder', 'drafts')
    } else if (messageIds) {
      mq = mq.in('id', messageIds)
      if (folder === 'starred') mq = mq.eq('is_starred', true)
      if (folder === 'archive') mq = mq.eq('is_archived', true)
    }

    const { data, error } = await mq
    if (error) throw error
    return json({ messages: data ?? [], count: (data ?? []).length })
  } catch (error) {
    console.error('email/inbox error:', error)
    return json({ error: error instanceof Error ? error.message : 'Failed to load inbox' }, 500)
  }
})
