'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Guard from '@/components/Guard';

function dateLabel(value) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function recipientLabel(id, profiles) {
  const p = profiles.find(item => item.id === id);
  return p ? (p.name || p.username || 'Palixia user') + (p.username ? ' (@' + p.username + ')' : '') : 'User';
}

export default function AdminMessagesPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [profiles, setProfiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [recipientId, setRecipientId] = useState('');
  const [replies, setReplies] = useState([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [usersResult, messagesResult] = await Promise.all([
      supabase.from('profiles').select('id,name,username,role').eq('status','active').order('name').limit(1000),
      supabase.from('admin_messages').select('id,subject,body,audience,created_at,admin_message_recipients(recipient_id)').order('created_at',{ascending:false}).limit(100),
    ]);
    if (usersResult.error || messagesResult.error) setError('Admin messaging database setup is missing. Run the current supabase/admin-messages.sql in Supabase SQL Editor.');
    else { setError(''); setProfiles(usersResult.data || []); setHistory(messagesResult.data || []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadReplies(message, targetRecipientId) {
    if (!targetRecipientId) { setReplies([]); return; }
    const { data, error: replyError } = await supabase.from('admin_message_replies')
      .select('id,sender_id,sender_is_admin,body,created_at')
      .eq('message_id', message.id).eq('recipient_id', targetRecipientId).order('created_at',{ascending:true});
    if (replyError) setError('Could not load this private conversation.');
    else { setError(''); setReplies(data || []); }
  }

  async function openThread(item, targetRecipientId) {
    setSelected(item);
    setRecipientId(targetRecipientId || '');
    setReply('');
    await loadReplies(item, targetRecipientId || '');
  }

  async function send(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    const { error: sendError } = await supabase.rpc('admin_send_message', { p_subject: subject.trim(), p_body: body.trim(), p_audience: audience, p_user_ids: audience === 'selected' ? selectedIds : null });
    if (sendError) setError(sendError.message || 'The message could not be sent.');
    else { setSuccess('Message sent. Each recipient has a separate private conversation.'); setSubject(''); setBody(''); setSelectedIds([]); await load(); }
    setBusy(false);
  }

  async function sendReply(e) {
    e.preventDefault(); if (!selected || !recipientId || !reply.trim()) return;
    setSendingReply(true); setError('');
    const { error: sendError } = await supabase.rpc('admin_reply_to_message', {
      p_message_id: selected.id, p_body: reply.trim(), p_recipient_id: recipientId
    });
    if (sendError) setError(sendError.message || 'Your reply could not be sent.');
    else { await loadReplies(selected, recipientId); setReply(''); }
    setSendingReply(false);
  }

  return <Guard roles={['admin']}><section className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
    <div className="sechead"><div><p className="eyebrow">PALIXIA ADMIN</p><h1 className="h1">Messages</h1></div><Link href="/admin" className="btn ghost small">Admin dashboard</Link></div>
    <p className="muted">Send messages to readers and authors. Every recipient gets a separate private conversation, including messages sent to groups.</p>
    {error && <p className="notice" role="alert">{error}</p>}{success && <p className="notice" role="status">{success}</p>}
    <form className="panel stack" onSubmit={send} style={{ padding: '1.2rem', gap: '.9rem' }}>
      <h2 className="h2">Compose message</h2>
      <div className="field"><label htmlFor="message-subject">Subject</label><input id="message-subject" className="in" maxLength={160} required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="What is this message about?"/></div>
      <div className="field"><label htmlFor="message-body">Message</label><textarea id="message-body" className="in" rows={7} maxLength={10000} required value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your message…"/></div>
      <div className="field"><label htmlFor="message-audience">Send to</label><select id="message-audience" className="in" value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">All active users</option><option value="authors">Authors only</option><option value="readers">Readers only</option><option value="selected">Selected users</option></select></div>
      {audience === 'selected' && <div className="field"><label htmlFor="message-users">Choose recipients</label><select id="message-users" className="in" multiple size={Math.min(8,Math.max(4,profiles.length))} value={selectedIds} onChange={e=>setSelectedIds(Array.from(e.target.selectedOptions).map(o=>o.value))}>{profiles.map(p=><option key={p.id} value={p.id}>{p.name || p.username} (@{p.username}) · {p.role}</option>)}</select><small className="muted">On mobile, use your device’s multi-select controls to choose more than one person.</small></div>}
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><span className="fine">{subject.length}/160 · {body.length}/10000 characters</span><button className="btn" type="submit" disabled={busy || !subject.trim() || !body.trim() || (audience === 'selected' && !selectedIds.length)}>{busy ? 'Sending…' : 'Send message'}</button></div>
    </form>
    <section className="stack"><div className="sechead"><h2 className="h2">Sent messages</h2><button type="button" className="btn ghost small" onClick={load} disabled={loading}>Refresh</button></div>
      {loading ? <p className="muted">Loading…</p> : history.length ? history.map(item=>{
        const recipients=item.admin_message_recipients || [];
        return <article key={item.id} className="panel stack" style={{padding:'1rem',gap:'.65rem'}}>
          <div><b>{item.subject}</b><p className="fine">{item.audience} · {recipients.length} recipients · {dateLabel(item.created_at)}</p></div>
          <details><summary className="muted" style={{cursor:'pointer'}}>View recipient conversations</summary>
            <div className="stack" style={{gap:'.4rem',marginTop:'.7rem'}}>
              {recipients.map(r=><button key={r.recipient_id} type="button" className="btn ghost small" style={{justifyContent:'space-between',width:'100%',textAlign:'left'}} onClick={()=>openThread(item,r.recipient_id)}><span>{recipientLabel(r.recipient_id,profiles)}</span><span>Open conversation →</span></button>)}
              {!recipients.length && <small className="muted">No active recipients were found for this message.</small>}
            </div>
          </details>
        </article>;
      }) : <p className="muted">No messages sent yet.</p>}
    </section>
    {selected && <section className="panel stack" style={{ padding:'1.2rem' }}>
      <div className="sechead"><div><p className="eyebrow">PRIVATE CONVERSATION</p><h2 className="h2">{selected.subject}</h2><p className="fine">With {recipientLabel(recipientId,profiles)}</p></div><button type="button" className="btn ghost small" onClick={()=>{setSelected(null);setReplies([]);setRecipientId('');setReply('');}}>Close</button></div>
      <div style={{ whiteSpace:'pre-wrap', lineHeight:1.7 }}>{selected.body}</div>
      <hr style={{border:0,borderTop:'1px solid var(--line)',width:'100%'}}/>
      <h3 className="h2">Replies</h3>
      {replies.map(item=><div key={item.id} className="panel" style={{ padding:'.85rem', background:item.sender_is_admin?'var(--soft)':'var(--surface)' }}><b>{item.sender_is_admin?'Palixia admin':'Recipient'}</b><p className="fine">{dateLabel(item.created_at)}</p><p style={{ whiteSpace:'pre-wrap' }}>{item.body}</p></div>)}
      {!replies.length && <p className="muted">No replies in this recipient’s private thread yet.</p>}
      <form className="stack" onSubmit={sendReply}><label htmlFor="admin-thread-reply">Reply to {recipientLabel(recipientId,profiles)}</label><textarea id="admin-thread-reply" className="in" rows={4} maxLength={5000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write your reply…" required/><div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><small className="muted">{reply.length}/5000</small><button className="btn" disabled={sendingReply||!reply.trim()}>{sendingReply?'Sending…':'Send reply'}</button></div></form>
    </section>}
  </section></Guard>;
}
