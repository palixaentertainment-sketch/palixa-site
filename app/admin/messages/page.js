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
    setSelected(item); setRecipientId(targetRecipientId || ''); setReply('');
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
    const { error: sendError } = await supabase.rpc('admin_reply_to_message', { p_message_id: selected.id, p_body: reply.trim(), p_recipient_id: recipientId });
    if (sendError) setError(sendError.message || 'Your reply could not be sent.');
    else { await loadReplies(selected, recipientId); setReply(''); }
    setSendingReply(false);
  }

  return <Guard roles={['admin']}><section className="am-page">
    <header className="am-heading">
      <div><p className="am-kicker">PALIXIA ADMIN</p><h1>Messages</h1><p>Reach your readers and authors, one conversation at a time.</p></div>
      <Link href="/admin" className="am-back">← Dashboard</Link>
    </header>
    {error && <p className="am-alert" role="alert">{error}</p>}
    {success && <p className="am-success" role="status">✓ {success}</p>}
    <form className="am-compose" onSubmit={send}>
      <div className="am-compose-title"><span>✎</span><div><h2>New message</h2><p>Send an update or start a conversation.</p></div></div>
      <label htmlFor="message-subject">Subject</label>
      <input id="message-subject" className="am-input" maxLength={160} required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Give your message a subject"/>
      <label htmlFor="message-body">Message</label>
      <textarea id="message-body" className="am-input" rows={6} maxLength={10000} required value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your message…"/>
      <label htmlFor="message-audience">Who should receive it?</label>
      <select id="message-audience" className="am-input" value={audience} onChange={e=>setAudience(e.target.value)}>
        <option value="all">All active users</option><option value="authors">Authors only</option><option value="readers">Readers only</option><option value="selected">Choose specific users</option>
      </select>
      {audience === 'selected' && <div className="am-recipient-picker"><div className="am-picker-head"><b>Select recipients</b><small>{selectedIds.length} selected</small></div><div className="am-user-list">
        {profiles.map(p=><label key={p.id} className="am-user"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={e=>setSelectedIds(current=>e.target.checked?[...current,p.id]:current.filter(id=>id!==p.id))}/><span><b>{p.name || p.username || 'Palixia user'}</b><small>@{p.username || 'user'} · {p.role}</small></span></label>)}
        {!profiles.length && <p className="am-muted">No active users found.</p>}
      </div></div>}
      <div className="am-compose-foot"><small>{subject.length}/160 · {body.length}/10000</small><button className="am-send" type="submit" disabled={busy || !subject.trim() || !body.trim() || (audience === 'selected' && !selectedIds.length)}>{busy ? 'Sending…' : 'Send message　↗'}</button></div>
    </form>

    <section className="am-history">
      <div className="am-section-head"><div><h2>Sent messages</h2><p>Your message history and private replies.</p></div><button type="button" className="am-refresh" onClick={load} disabled={loading}>↻ Refresh</button></div>
      {loading ? <p className="am-muted">Loading message history…</p> : history.length ? <div className="am-history-list">{history.map(item=>{
        const recipients=item.admin_message_recipients || [];
        return <article key={item.id} className="am-history-card">
          <div className="am-history-icon">✉</div>
          <div className="am-history-main"><b>{item.subject}</b><p>{item.body.slice(0,100)}{item.body.length>100?'…':''}</p><div className="am-meta"><span>{item.audience}</span><span>{recipients.length} recipients</span><time>{dateLabel(item.created_at)}</time></div>
            <details className="am-recipients"><summary>View recipient conversations <span>({recipients.length})</span></summary><div className="am-recipient-list">
              {recipients.map(r=><button key={r.recipient_id} type="button" onClick={()=>openThread(item,r.recipient_id)}><span>{recipientLabel(r.recipient_id,profiles)}</span><b>Open →</b></button>)}
              {!recipients.length && <small className="am-muted">No active recipients were found.</small>}
            </div></details>
          </div>
        </article>;
      })}</div> : <div className="am-empty"><span>✉</span><b>No messages sent yet</b><p>Your sent messages will appear here.</p></div>}
    </section>

    {selected && <section className="am-thread">
      <div className="am-thread-head"><div><p className="am-kicker">PRIVATE CONVERSATION</p><h2>{selected.subject}</h2><p>With {recipientLabel(recipientId,profiles)}</p></div><button type="button" className="am-close" onClick={()=>{setSelected(null);setReplies([]);setRecipientId('');setReply('');}}>Close ✕</button></div>
      <div className="am-original"><span>PALIXIA MESSAGE</span><p>{selected.body}</p></div>
      <div className="am-reply-list">{replies.map(item=><div key={item.id} className={'am-reply ' +(item.sender_is_admin?'admin-reply':'user-reply')}><small>{item.sender_is_admin?'PALIXIA ADMIN':'RECIPIENT'} · {dateLabel(item.created_at)}</small><p>{item.body}</p></div>)}
        {!replies.length && <p className="am-muted">No replies in this recipient’s private thread yet.</p>}
      </div>
      <form className="am-reply-form" onSubmit={sendReply}><label htmlFor="admin-thread-reply">Reply to this recipient</label><textarea id="admin-thread-reply" className="am-input" rows={3} maxLength={5000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a private reply…" required/><div><small>{reply.length}/5000</small><button className="am-send" disabled={sendingReply||!reply.trim()}>{sendingReply?'Sending…':'Send reply ↗'}</button></div></form>
    </section>}
    <AdminMessageStyles/>
  </section></Guard>;
}

function AdminMessageStyles(){return <style jsx global>{`
.am-page{width:min(100%,900px);margin:0 auto;padding:clamp(1rem,3vw,2rem) 1rem 5rem;color:var(--fg);display:grid;gap:1.25rem}
.am-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;padding-bottom:1.2rem;border-bottom:1px solid var(--line)}
.am-kicker{color:var(--accent);font:700 .67rem var(--mono);letter-spacing:.12em;margin-bottom:.4rem}
.am-heading h1{font-size:clamp(2rem,7vw,2.6rem);font-weight:850;letter-spacing:-.055em;line-height:1.05}
.am-heading p:not(.am-kicker){margin-top:.45rem;color:var(--muted);font-size:.88rem}
.am-back,.am-refresh{padding:.55rem .75rem;border:1px solid var(--line);border-radius:9px;color:var(--accent);font-size:.8rem;font-weight:700;white-space:nowrap}
.am-compose{display:grid;gap:.65rem;padding:clamp(1rem,3vw,1.4rem);border:1px solid var(--line);border-radius:17px;background:var(--surface);box-shadow:0 8px 25px rgba(40,20,70,.04)}
.am-compose-title{display:flex;align-items:center;gap:.75rem;margin-bottom:.4rem}
.am-compose-title>span{display:grid;place-items:center;width:2.65rem;height:2.65rem;border-radius:12px;background:var(--soft);color:var(--accent);font-size:1.25rem}
.am-compose-title h2,.am-section-head h2{font-size:1.2rem;font-weight:850;letter-spacing:-.025em}
.am-compose-title p,.am-section-head p{color:var(--muted);font-size:.8rem;margin-top:.15rem}
.am-compose label,.am-reply-form label{font-size:.8rem;font-weight:750;margin-top:.3rem}
.am-input{display:block;width:100%;min-width:0;padding:.75rem .85rem;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg);font:inherit;font-size:.9rem;outline-offset:2px}
.am-input:focus{border-color:var(--accent)}
.am-input::placeholder{color:var(--muted);opacity:.75}
.am-compose-foot,.am-reply-form>div{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-top:.35rem}
.am-compose-foot small,.am-reply-form small{color:var(--muted);font-size:.7rem}
.am-send{display:inline-flex;align-items:center;justify-content:center;padding:.75rem 1rem;border:0;border-radius:9px;background:var(--accent);color:#fff;font-weight:750;font-size:.84rem}
.am-send:disabled{opacity:.5;cursor:wait}
.am-recipient-picker{border:1px solid var(--line);border-radius:11px;overflow:hidden;background:var(--bg)}
.am-picker-head{display:flex;justify-content:space-between;gap:.5rem;padding:.7rem .8rem;background:var(--soft);font-size:.8rem}
.am-picker-head small{color:var(--muted)}
.am-user-list{max-height:220px;overflow:auto;padding:.3rem .75rem}
.am-user{display:flex;align-items:center;gap:.7rem;padding:.6rem 0;border-bottom:1px solid var(--line);cursor:pointer}
.am-user:last-child{border-bottom:0}
.am-user input{width:1.05rem;height:1.05rem;accent-color:var(--accent);flex:none}
.am-user span{display:grid;gap:.1rem;min-width:0}
.am-user b{font-size:.82rem;overflow-wrap:anywhere}
.am-user small{color:var(--muted);font-size:.72rem}
.am-history{display:grid;gap:.8rem}
.am-section-head{display:flex;justify-content:space-between;align-items:center;gap:1rem}
.am-history-list{display:grid;gap:.65rem}
.am-history-card{display:flex;align-items:flex-start;gap:.8rem;padding:.9rem;border:1px solid var(--line);border-radius:14px;background:var(--bg)}
.am-history-icon{display:grid;place-items:center;flex:none;width:2.5rem;height:2.5rem;border-radius:11px;background:var(--soft);color:var(--accent);font-size:1.15rem}
.am-history-main{min-width:0;flex:1}
.am-history-main>b{font-size:.92rem;overflow-wrap:anywhere}
.am-history-main>p{margin-top:.25rem;color:var(--muted);font-size:.8rem;line-height:1.5;overflow-wrap:anywhere}
.am-meta{display:flex;gap:.45rem .8rem;align-items:center;flex-wrap:wrap;margin-top:.55rem;color:var(--muted);font-size:.68rem}
.am-meta span:first-child{padding:.18rem .45rem;border-radius:99px;background:var(--soft);color:var(--accent);font-weight:700;text-transform:capitalize}
.am-recipients{margin-top:.7rem;border-top:1px solid var(--line);padding-top:.55rem}
.am-recipients summary{cursor:pointer;color:var(--accent);font-size:.78rem;font-weight:750}
.am-recipients summary span{color:var(--muted);font-weight:500}
.am-recipient-list{display:grid;gap:.35rem;margin-top:.55rem}
.am-recipient-list button{display:flex;justify-content:space-between;align-items:center;gap:.5rem;width:100%;padding:.6rem .65rem;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-size:.77rem;text-align:left}
.am-recipient-list button span{min-width:0;overflow-wrap:anywhere}
.am-recipient-list button b{color:var(--accent);white-space:nowrap;font-size:.72rem}
.am-muted{color:var(--muted);font-size:.82rem}
.am-empty{display:grid;justify-items:center;gap:.4rem;padding:2rem;border:1px dashed var(--line);border-radius:14px;text-align:center;background:var(--surface)}
.am-empty>span{color:var(--accent);font-size:1.7rem}.am-empty p{color:var(--muted);font-size:.82rem}
.am-thread{display:grid;gap:1rem;padding:1rem;border:1px solid var(--line);border-radius:16px;background:var(--surface)}
.am-thread-head{display:flex;justify-content:space-between;align-items:flex-start;gap:.8rem}
.am-thread-head h2{font-size:1.15rem;font-weight:850;overflow-wrap:anywhere}
.am-thread-head>div>p:last-child{color:var(--muted);font-size:.78rem;margin-top:.2rem}
.am-close{padding:.45rem .6rem;border:1px solid var(--line);border-radius:8px;font-size:.75rem;color:var(--muted);white-space:nowrap}
.am-original{padding:.9rem;border-radius:11px;background:var(--bg);border:1px solid var(--line)}
.am-original span,.am-reply small{font:700 .6rem var(--mono);letter-spacing:.09em;color:var(--muted)}
.am-original p,.am-reply p{margin-top:.45rem;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font-size:.88rem}
.am-reply-list{display:grid;gap:.65rem}
.am-reply{max-width:90%;padding:.75rem .85rem;border:1px solid var(--line);border-radius:12px;background:var(--bg)}
.am-reply.user-reply{justify-self:end;background:var(--soft);border-color:#d8c8f5}
.am-reply.admin-reply{justify-self:start}
.am-reply-form{display:grid;gap:.55rem;padding-top:.9rem;border-top:1px solid var(--line)}
.am-alert,.am-success{padding:.7rem .85rem;border-radius:9px;font-size:.82rem}
.am-alert{background:#fff2f5;color:#9f1239;border:1px solid #f1c5d0}
.am-success{background:#effaf2;color:#166534;border:1px solid #b7e4c2}
@media(max-width:430px){.am-page{padding-inline:.75rem}.am-heading{flex-direction:column}.am-back{align-self:flex-start}.am-compose-foot .am-send{width:100%}.am-history-card{gap:.6rem;padding:.75rem}.am-history-icon{width:2.2rem;height:2.2rem}.am-reply{max-width:97%}.am-thread{padding:.8rem}}
:root[data-theme="dark"] .am-alert{background:#351b2a;color:#fecdd3;border-color:#713047}
:root[data-theme="dark"] .am-success{background:#142b20;color:#bbf7d0;border-color:#28583b}
`}</style>}
