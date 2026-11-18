'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [profiles, setProfiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [usersResult, messagesResult] = await Promise.all([
      supabase.from('profiles').select('id,name,username,role').eq('status','active').order('name').limit(1000),
      supabase.from('admin_messages').select('id,subject,audience,created_at').order('created_at',{ascending:false}).limit(30),
    ]);
    if (usersResult.error || messagesResult.error) {
      setError('Admin messaging database setup is missing. Run supabase/admin-messages.sql in Supabase SQL Editor.');
    } else {
      setProfiles(usersResult.data || []);
      setHistory(messagesResult.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function send(e) {
    e.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    const { data, error: sendError } = await supabase.rpc('admin_send_message', {
      p_subject: subject.trim(),
      p_body: body.trim(),
      p_audience: audience,
      p_user_ids: audience === 'selected' ? selectedIds : null,
    });
    if (sendError) setError(sendError.message || 'The message could not be sent.');
    else {
      setSuccess('Message sent successfully.');
      setSubject(''); setBody(''); setSelectedIds([]);
      await load();
    }
    setBusy(false);
  }

  return <Guard roles={['admin']}><section className="stack" style={{ maxWidth: 900, margin: '0 auto' }}>
    <div className="sechead"><div><p className="eyebrow">PALIXIA ADMIN</p><h1 className="h1">Messages</h1></div><Link href="/admin" className="btn ghost small">Admin dashboard</Link></div>
    <p className="muted">Send private, one-way messages to Palixia readers and authors. Recipients can read messages but cannot reply.</p>
    {error && <p className="notice" role="alert">{error}</p>}
    {success && <p className="notice" role="status">{success}</p>}
    <form className="panel stack" onSubmit={send} style={{ padding: '1.2rem', gap: '.9rem' }}>
      <h2 className="h2">Compose message</h2>
      <div className="field"><label htmlFor="message-subject">Subject</label><input id="message-subject" className="in" maxLength={160} required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="What is this message about?"/></div>
      <div className="field"><label htmlFor="message-body">Message</label><textarea id="message-body" className="in" rows={7} maxLength={10000} required value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your message…"/></div>
      <div className="field"><label htmlFor="message-audience">Send to</label><select id="message-audience" className="in" value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">All active users</option><option value="authors">Authors only</option><option value="readers">Readers only</option><option value="selected">Selected users</option></select></div>
      {audience === 'selected' && <div className="field"><label htmlFor="message-users">Choose recipients (hold Ctrl or use multi-select)</label><select id="message-users" className="in" multiple size={Math.min(8,Math.max(4,profiles.length))} value={selectedIds} onChange={e=>setSelectedIds(Array.from(e.target.selectedOptions).map(o=>o.value))}>{profiles.map(p=><option key={p.id} value={p.id}>{p.name} (@{p.username}) · {p.role}</option>)}</select></div>}
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><span className="fine">{subject.length}/160 · {body.length}/10000 characters</span><button className="btn" type="submit" disabled={busy || !subject.trim() || !body.trim() || (audience === 'selected' && !selectedIds.length)}>{busy ? 'Sending…' : 'Send message'}</button></div>
    </form>
    <section className="stack"><div className="sechead"><h2 className="h2">Recently sent</h2><button type="button" className="btn ghost small" onClick={load} disabled={loading}>Refresh</button></div>
      {loading ? <p className="muted">Loading…</p> : history.length ? history.map(item=><article className="panel" key={item.id} style={{ padding: '.85rem 1rem' }}><b>{item.subject}</b><p className="fine">{item.audience} · {new Date(item.created_at).toLocaleString()}</p></article>) : <p className="muted">No messages sent yet.</p>}
    </section>
  </section></Guard>;
}
