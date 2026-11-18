'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function dateLabel(value) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function timeLabel(value) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [replies, setReplies] = useState([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || !configured) { setItems([]); setBusy(false); return; }
    setBusy(true);
    const { data, error: queryError } = await supabase.from('admin_message_recipients')
      .select('id,read_at,created_at,admin_messages!admin_message_recipients_message_id_fkey(id,subject,body,created_at)')
      .eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (queryError) { setError('Messages are not enabled yet. Please contact Palixia support.'); setItems([]); }
    else { setError(''); setItems((data || []).filter(row => row.admin_messages)); }
    setBusy(false);
  }, [user]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  async function refreshReplies(row) {
    const { data, error: replyError } = await supabase.from('admin_message_replies')
      .select('id,sender_id,sender_is_admin,body,created_at')
      .eq('message_id', row.admin_messages.id).eq('recipient_id', user.id).order('created_at', { ascending: true });
    if (replyError) setError('Could not load this conversation. Please refresh and try again.');
    else setReplies(data || []);
  }

  async function openMessage(row) {
    setSelected(row); setError('');
    await refreshReplies(row);
    if (!row.read_at) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase.from('admin_message_recipients').update({ read_at: now }).eq('id', row.id).eq('recipient_id', user.id);
      if (!updateError) {
        setItems(current => current.map(item => item.id === row.id ? { ...item, read_at: now } : item));
        setSelected(current => current?.id === row.id ? { ...current, read_at: now } : current);
      }
    }
  }

  async function sendReply(e) {
    e.preventDefault(); if (!selected || !reply.trim()) return;
    setSending(true); setError('');
    const { error: sendError } = await supabase.rpc('admin_reply_to_message', {
      p_message_id: selected.admin_messages.id, p_body: reply.trim(), p_recipient_id: user.id
    });
    if (sendError) setError(sendError.message || 'Your reply could not be sent.');
    else { await refreshReplies(selected); setReply(''); }
    setSending(false);
  }

  if (loading) return <section className="px-inbox"><p className="px-loading">Loading your messages…</p><MessageStyles /></section>;
  if (!user) return <section className="px-inbox"><div className="px-empty"><div className="px-empty-icon">✉</div><h1>Messages</h1><p>Log in to view messages from the Palixia team.</p><Link className="px-login" href="/login">Log in</Link></div><MessageStyles /></section>;

  return <section className={selected ? 'px-inbox px-inbox-thread' : 'px-inbox'}>
    {selected ? <div className="px-chat-screen">
      <header className="px-chat-header">
        <button type="button" className="px-chat-back" onClick={() => { setSelected(null); setReplies([]); setReply(''); setError(''); }} aria-label="Back to inbox">‹</button>
        <div className="px-brand-avatar"><img src="/brand/palixa-logo-transparent.svg" alt="Palixia" /></div>
        <div className="px-chat-person"><b>Palixia</b><span><i/> Official account</span></div>
        <span className="px-private-mark" aria-label="Private conversation">🔒</span>
      </header>

      <div className="px-chat-scroll">
        <div className="px-day-divider"><span>MESSAGE FROM PALIXIA</span></div>
        <article className="px-original-message">
          <div className="px-original-meta"><b>Palixia</b><time>{dateLabel(selected.admin_messages.created_at)}</time></div>
          <h1>{selected.admin_messages.subject}</h1>
          <p>{selected.admin_messages.body}</p>
        </article>
        <div className="px-chat-divider"><span>REPLIES</span></div>
        {replies.map(item => <div key={item.id} className={'px-chat-row ' + (item.sender_is_admin ? 'px-from-team' : 'px-from-user')}>
          {item.sender_is_admin && <div className="px-mini-avatar"><img src="/brand/palixa-logo-transparent.svg" alt="Palixia" /></div>}
          <div className="px-chat-message">
            <div className="px-chat-bubble">{item.body}</div>
            <time>{timeLabel(item.created_at)}</time>
          </div>
        </div>)}
        {!replies.length && <div className="px-chat-hint"><span>✦</span><p>This is your private conversation with Palixia. Send a reply whenever you're ready.</p></div>}
        {error && <p className="px-error" role="alert">{error}</p>}
      </div>

      <form className="px-composer" onSubmit={sendReply}>
        <label className="sr-only" htmlFor="message-reply">Write a reply</label>
        <textarea id="message-reply" value={reply} onChange={e => setReply(e.target.value)} rows={1} maxLength={5000} placeholder="Write a message…" required />
        <button type="submit" disabled={sending || !reply.trim()} aria-label="Send reply">
          {sending ? <span className="px-send-loading">…</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5 21 12 3 3.5l.2 6.6L15 12 3.2 13.9 3 20.5Z" fill="currentColor"/></svg>}
        </button>
      </form>
    </div> : <>
      <header className="px-inbox-heading">
        <div><span className="px-eyebrow">PALIXIA COMMUNITY</span><h1>Messages</h1><p>Conversations with the Palixia team.</p></div>
        <div className="px-heading-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5h18v13H3zM3.5 6l8.5 7 8.5-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg></div>
      </header>
      <div className="px-inbox-section"><div className="px-section-label"><b>INBOX</b><span>{items.filter(item => !item.read_at).length ? items.filter(item => !item.read_at).length + ' unread' : 'You’re all caught up'}</span></div>
      {error && <p className="px-error" role="alert">{error}</p>}
      {busy ? <p className="px-loading">Loading messages…</p> : !items.length ? <div className="px-empty"><div className="px-empty-icon">✉</div><h2>Your inbox is quiet</h2><p>Messages from the Palixia team will appear here.</p></div> :
        <div className="px-message-list">{items.map(row => <button key={row.id} type="button" onClick={() => openMessage(row)} className={'px-message-row ' + (!row.read_at ? 'is-unread' : '')}>
          <div className="px-brand-avatar"><img src="/brand/palixa-logo-transparent.svg" alt="Palixia" /></div><div className="px-row-content">
            <div className="px-row-top"><b>Palixia <span className="px-verified">✓</span></b><time>{dateLabel(row.admin_messages.created_at)}</time></div>
            <strong>{row.admin_messages.subject}</strong><p>{row.admin_messages.body.slice(0,110)}{row.admin_messages.body.length>110?'…':''}</p>
          </div>{!row.read_at && <span className="px-unread-dot" aria-label="Unread"/>}
        </button>)}</div>}
      </div>
    </>}
    <MessageStyles />
  </section>;
}

function MessageStyles() {
  return <style jsx global>{`
    .px-inbox{width:min(100%,780px);margin:0 auto;padding:1.25rem 1rem 5rem;min-height:68vh;color:var(--fg)}
    .px-inbox-heading{display:flex;align-items:center;justify-content:space-between;padding:.3rem 0 1.25rem;border-bottom:1px solid var(--line)}
    .px-eyebrow{font:700 .65rem var(--mono);letter-spacing:.13em;color:var(--accent)}
    .px-inbox-heading h1{font-size:2.2rem;font-weight:850;letter-spacing:-.055em;line-height:1.1;margin-top:.25rem}
    .px-inbox-heading p{font-size:.88rem;color:var(--muted);margin-top:.35rem}
    .px-heading-icon{width:3rem;height:3rem;display:grid;place-items:center;border-radius:50%;background:var(--soft);color:var(--accent)}
    .px-heading-icon svg{width:1.45rem;height:1.45rem}
    .px-inbox-section{padding-top:1.1rem}
    .px-section-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:.55rem;font-size:.73rem;letter-spacing:.08em}
    .px-section-label span{color:var(--muted);font-size:.72rem;letter-spacing:0}
    .px-message-list{display:grid}
    .px-message-row{display:flex;align-items:center;gap:.8rem;width:100%;padding:1rem .25rem;border-bottom:1px solid var(--line);text-align:left;color:var(--fg);min-width:0}
    .px-message-row.is-unread{background:linear-gradient(90deg,var(--soft),transparent 85%)}
    .px-brand-avatar{display:grid;place-items:center;flex:none;width:2.9rem;height:2.9rem;padding:.28rem;border-radius:50%;background:#fff;border:1px solid var(--line);overflow:hidden;box-shadow:0 3px 10px #4c1d9525}.px-brand-avatar img{width:100%;height:100%;object-fit:contain;display:block}
    .px-row-content{min-width:0;flex:1;display:grid;gap:.2rem}
    .px-row-top{display:flex;justify-content:space-between;align-items:center;gap:.5rem}
    .px-row-top b{font-size:.88rem}.px-row-top time{font-size:.67rem;color:var(--muted);white-space:nowrap}
    .px-verified{display:inline-grid;place-items:center;width:.9rem;height:.9rem;border-radius:50%;background:var(--accent);color:white;font-size:.58rem}
    .px-row-content strong{font-size:.9rem;line-height:1.35}
    .px-row-content p{font-size:.78rem;color:var(--muted);line-height:1.45;overflow-wrap:anywhere}
    .px-unread-dot{width:.48rem;height:.48rem;border-radius:50%;background:var(--accent);flex:none}
    .px-empty{display:grid;justify-items:center;text-align:center;gap:.55rem;padding:3rem 1rem;color:var(--muted)}
    .px-empty h1,.px-empty h2{font-size:1.2rem;color:var(--fg);font-weight:800}.px-empty p{font-size:.85rem}
    .px-empty-icon{display:grid;place-items:center;width:3.4rem;height:3.4rem;border-radius:50%;background:var(--soft);color:var(--accent);font-size:1.5rem;margin-bottom:.3rem}
    .px-login{padding:.65rem 1.2rem;border-radius:99px;background:var(--accent);color:white;font-weight:700;margin-top:.5rem}
    .px-loading{text-align:center;padding:2rem;color:var(--muted)}
    .px-error{margin:.65rem 0;padding:.65rem .8rem;border-radius:10px;background:#fff1f3;color:#9f1239;font-size:.8rem}
    /* Native app conversation screen */
    .px-inbox-thread{width:100%;max-width:760px;padding:0;margin:0 auto;min-height:0}
    .px-chat-screen{height:calc(100dvh - 10.1rem);min-height:390px;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}
    .px-chat-header{display:flex;align-items:center;gap:.75rem;flex:none;padding:.7rem .85rem;border-bottom:1px solid var(--line);background:var(--bg)}
    .px-chat-back{width:2rem;height:2.4rem;display:grid;place-items:center;color:var(--accent);font-size:2.1rem;line-height:1}
    .px-chat-header .px-brand-avatar{width:2.55rem;height:2.55rem;padding:.22rem}
    .px-chat-person{display:grid;gap:.08rem;flex:1}
    .px-chat-person b{font-size:.94rem}.px-chat-person span{font-size:.72rem;color:var(--muted);display:flex;align-items:center;gap:.35rem}
    .px-chat-person i{width:.42rem;height:.42rem;border-radius:50%;background:#22a06b}
    .px-private-mark{font-size:.85rem;opacity:.65}
    .px-chat-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:.9rem 1rem 1.2rem;display:flex;flex-direction:column;gap:.9rem;scrollbar-width:thin}
    .px-day-divider,.px-chat-divider{display:flex;align-items:center;justify-content:center;gap:.7rem;color:var(--muted);font:700 .59rem var(--mono);letter-spacing:.12em}
    .px-day-divider:before,.px-day-divider:after,.px-chat-divider:before,.px-chat-divider:after{content:"";height:1px;background:var(--line);flex:1}
    .px-original-message{align-self:flex-start;width:min(94%,39rem);padding:1rem 1.05rem;border:1px solid var(--line);border-radius:4px 17px 17px 17px;background:var(--surface);box-shadow:0 3px 14px rgba(45,20,90,.035)}
    .px-original-meta{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.55rem}
    .px-original-meta b{font-size:.75rem;color:var(--accent)}.px-original-meta time{font-size:.65rem;color:var(--muted)}
    .px-original-message h1{font-size:1.03rem;line-height:1.35;font-weight:800;margin-bottom:.65rem}
    .px-original-message p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.88rem;line-height:1.65}
    .px-chat-divider{margin:.1rem 0}
    .px-chat-row{display:flex;align-items:flex-end;gap:.45rem;max-width:88%}
    .px-from-user{align-self:flex-end;justify-content:flex-end}
    .px-from-team{align-self:flex-start}
    .px-mini-avatar{width:1.55rem;height:1.55rem;display:grid;place-items:center;flex:none;border-radius:50%;background:#fff;border:1px solid var(--line);padding:.15rem;overflow:hidden}.px-mini-avatar img{width:100%;height:100%;object-fit:contain;display:block}
    .px-chat-message{display:grid;gap:.22rem;min-width:0}
    .px-chat-bubble{padding:.72rem .9rem;border-radius:16px 16px 16px 5px;background:var(--surface);border:1px solid var(--line);font-size:.9rem;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
    .px-from-user .px-chat-bubble{background:#eee5fc;border-color:#e0d1f8;color:#28134a;border-radius:16px 16px 5px 16px}
    .px-chat-message time{font-size:.63rem;color:var(--muted);padding:0 .25rem}
    .px-from-user .px-chat-message time{text-align:right}
    .px-chat-hint{align-self:center;display:flex;align-items:center;gap:.6rem;max-width:23rem;margin:.3rem auto;padding:.7rem .85rem;border-radius:12px;background:var(--surface);color:var(--muted);font-size:.77rem}
    .px-chat-hint span{color:var(--accent);font-size:1.1rem}
    .px-composer{display:flex;align-items:flex-end;gap:.6rem;flex:none;padding:.65rem .8rem calc(.65rem + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:var(--bg)}
    .px-composer textarea{flex:1;min-width:0;max-height:7rem;min-height:2.7rem;resize:none;padding:.68rem .9rem;border:1px solid var(--line);border-radius:22px;background:var(--surface);color:var(--fg);font:inherit;font-size:.9rem;line-height:1.35;outline-offset:2px}
    .px-composer textarea::placeholder{color:var(--muted)}
    .px-composer button{width:2.7rem;height:2.7rem;display:grid;place-items:center;flex:none;border-radius:50%;background:var(--accent);color:white;box-shadow:0 3px 9px #4c1d9528}
    .px-composer button:disabled{opacity:.45}
    .px-composer button svg{width:1.25rem;height:1.25rem}
    .px-send-loading{font-size:1.3rem;font-weight:800}
    @media(min-width:52rem){.px-inbox-thread{padding:0 1rem}.px-chat-screen{height:calc(100vh - 8rem);min-height:500px;border:1px solid var(--line);border-radius:14px;margin:1rem auto;box-shadow:0 8px 30px rgba(45,20,90,.05)}.px-chat-header{padding:.85rem 1.1rem}.px-chat-scroll{padding:1.2rem 1.4rem}.px-composer{padding:.8rem 1rem}}
    @media(max-width:420px){.px-inbox{padding:1rem .85rem 5rem}.px-inbox-thread{padding:0}.px-chat-screen{height:calc(100dvh - 10.2rem)}.px-chat-scroll{padding:.8rem .75rem 1rem;gap:.75rem}.px-original-message{width:97%;padding:.85rem .9rem}.px-chat-row{max-width:94%}.px-composer{padding-inline:.65rem}}
    :root[data-theme="dark"] .px-from-user .px-chat-bubble{background:#38245a;border-color:#5b4380;color:#fff}
    :root[data-theme="dark"] .px-error{background:#351b2a;color:#fecdd3}
    @media(prefers-reduced-motion:reduce){.px-chat-scroll{scroll-behavior:auto}}
  `}</style>;
}
