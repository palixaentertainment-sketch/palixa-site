'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Guard from '@/components/Guard';

function dateLabel(value) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

export default function AdminMessagesPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [profiles, setProfiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
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
    if (usersResult.error || messagesResult.error) setError('Admin messaging database setup is missing. Run the updated supabase/admin-messages.sql in Supabase SQL Editor.');
    else { setError(''); setProfiles(usersResult.data || []); setHistory(messagesResult.data || []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openThread(item) {
    setSelected(item); setError('');
    const { data, error: replyError } = await supabase.from('admin_message_replies').select('id,sender_id,sender_is_admin,body,created_at').eq('message_id', item.id).order('created_at',{ascending:true});
    if (replyError) setError('Could not load replies for this conversation.');
    else setReplies(data || []);
  }

  async function send(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    const { error: sendError } = await supabase.rpc('admin_send_message', { p_subject: subject.trim(), p_body: body.trim(), p_audience: audience, p_user_ids: audience === 'selected' ? selectedIds : null });
    if (sendError) setError(sendError.message || 'The message could not be sent.');
    else { setSuccess('Message sent successfully. Recipients can now reply in their inbox.'); setSubject(''); setBody(''); setSelectedIds([]); await load(); }
    setBusy(false);
  }

  async function sendReply(e) {
    e.preventDefault(); if (!selected || !reply.trim()) return;
    setSendingReply(true); setError('');
    const { error: sendError } = await supabase.rpc('admin_reply_to_message', { p_message_id: selected.id, p_body: reply.trim() });
    if (sendError) setError(sendError.message || 'Your reply could not be sent.');
    else {
      const { data } = await supabase.from('admin_message_replies').select('id,sender_id,sender_is_admin,body,created_at').eq('message_id', selected.id).order('created_at',{ascending:true});
      setReplies(data || []); setReply('');
    }
    setSendingReply(false);
  }

  return <Guard roles={['admin']}><section className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
    <div className="sechead"><div><p className="eyebrow">PALIXIA ADMIN</p><h1 className="h1">Messages</h1></div><Link href="/admin" className="btn ghost small">Admin dashboard</Link></div>
    <p className="muted">Send private messages to readers and authors. Recipients can reply, and all replies stay in the original conversation.</p>
    {error && <p className="notice" role="alert">{error}</p>}{success && <p className="notice" role="status">{success}</p>}
    <form className="panel stack" onSubmit={send} style={{ padding: '1.2rem', gap: '.9rem' }}>
      <h2 className="h2">Compose message</h2>
      <div className="field"><label htmlFor="message-subject">Subject</label><input id="message-subject" className="in" maxLength={160} required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="What is this message about?"/></div>
      <div className="field"><label htmlFor="message-body">Message</label><textarea id="message-body" className="in" rows={7} maxLength={10000} required value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your message…"/></div>
      <div className="field"><label htmlFor="message-audience">Send to</label><select id="message-audience" className="in" value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">All active users</option><option value="authors">Authors only</option><option value="readers">Readers only</option><option value="selected">Selected users</option></select></div>
      {audience === 'selected' && <div className="field"><label htmlFor="message-users">Choose recipients</label><select id="message-users" className="in" multiple size={Math.min(8,Math.max(4,profiles.length))} value={selectedIds} onChange={e=>setSelectedIds(Array.from(e.target.selectedOptions).map(o=>o.value))}>{profiles.map(p=><option key={p.id} value={p.id}>{p.name} (@{p.username}) · {p.role}</option>)}</select></div>}
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><span className="fine">{subject.length}/160 · {body.length}/10000 characters</span><button className="btn" type="submit" disabled={busy || !subject.trim() || !body.trim() || (audience === 'selected' && !selectedIds.length)}>{busy ? 'Sending…' : 'Send message'}</button></div>
    </form>
    <section className="stack"><div className="sechead"><h2 className="h2">Conversations</h2><button type="button" className="btn ghost small" onClick={load} disabled={loading}>Refresh</button></div>
      {loading ? <p className="muted">Loading…</p> : history.length ? history.map(item=><button type="button" key={item.id} onClick={()=>openThread(item)} className="panel" style={{ display:'block', width:'100%', padding:'.9rem 1rem', textAlign:'left', color:'var(--fg)', cursor:'pointer' }}><b>{item.subject}</b><p className="fine">{item.audience} · {item.admin_message_recipients?.length || 0} recipients · {dateLabel(item.created_at)}</p></button>) : <p className="muted">No conversations yet.</p>}
    </section>
    {selected && <section className="panel stack" style={{ padding:'1.2rem' }}>
      <div className="sechead"><div><p className="eyebrow">CONVERSATION</p><h2 className="h2">{selected.subject}</h2></div><button type="button" className="btn ghost small" onClick={()=>{setSelected(null);setReplies([]);}}>Close</button></div>
      <div style={{ whiteSpace:'pre-wrap', lineHeight:1.7 }}>{selected.body}</div>
      {replies.map(item=><div key={item.id} className="panel" style={{ padding:'.85rem', background:item.sender_is_admin?'var(--soft)':'var(--surface)' }}><b>{item.sender_is_admin?'Palixia admin':'Author / recipient'}</b><p className="fine">{dateLabel(item.created_at)}</p><p style={{ whiteSpace:'pre-wrap' }}>{item.body}</p></div>)}
      {!replies.length && <p className="muted">No replies yet.</p>}
      <form className="stack" onSubmit={sendReply}><label htmlFor="admin-thread-reply">Reply to this conversation</label><textarea id="admin-thread-reply" className="in" rows={4} maxLength={5000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write your reply…" required/><div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><small className="muted">{reply.length}/5000</small><button className="btn" disabled={sendingReply||!reply.trim()}>{sendingReply?'Sending…':'Send reply'}</button></div></form>
    </section>}
  </section></Guard>;
}