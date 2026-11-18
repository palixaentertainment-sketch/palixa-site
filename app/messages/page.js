'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function dateLabel(value) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

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

  if (loading) return <section className="msg-page"><p className="msg-muted">Loading your inbox…</p><MessageStyles /></section>;
  if (!user) return <section className="msg-page"><div className="msg-empty"><div className="msg-mark">✉</div><h1>Messages</h1><p>Log in to view messages from the Palixia team.</p><Link className="msg-primary" href="/login">Log in</Link></div><MessageStyles /></section>;

  return <section className="msg-page">
    {selected ? <>
      <div className="msg-topline">
        <button type="button" className="msg-back" onClick={() => { setSelected(null); setReplies([]); setReply(''); setError(''); }}><span aria-hidden="true">←</span> Inbox</button>
        <span className="msg-secure">PRIVATE MESSAGE</span>
      </div>
      <article className="msg-thread">
        <header className="msg-thread-head">
          <div className="msg-avatar msg-avatar-large">P</div>
          <div className="msg-thread-sender"><b>Palixia</b><span>Official message</span></div>
          <time>{dateLabel(selected.admin_messages.created_at)}</time>
        </header>
        <h1 className="msg-subject">{selected.admin_messages.subject}</h1>
        <div className="msg-original">{selected.admin_messages.body}</div>
        <div className="msg-divider"><span>YOUR CONVERSATION</span></div>
        <div className="msg-replies">
          {replies.map(item => <div key={item.id} className={'msg-bubble-wrap ' + (item.sender_is_admin ? 'from-palixia' : 'from-you')}>
            <span className="msg-bubble-label">{item.sender_is_admin ? 'PALIXIA' : 'YOU'}</span>
            <div className="msg-bubble">{item.body}</div>
            <time>{dateLabel(item.created_at)}</time>
          </div>)}
          {!replies.length && <div className="msg-first-reply"><span>↳</span><p>Have something to share? Reply here and the Palixia team will see it.</p></div>}
        </div>
        {error && <p className="msg-error" role="alert">{error}</p>}
        <form className="msg-composer" onSubmit={sendReply}>
          <label className="sr-only" htmlFor="message-reply">Your reply</label>
          <textarea id="message-reply" value={reply} onChange={e => setReply(e.target.value)} rows={2} maxLength={5000} placeholder="Write a reply…" required />
          <div className="msg-compose-foot"><small>{reply.length}/5000</small><button className="msg-primary" disabled={sending || !reply.trim()}>{sending ? 'Sending…' : 'Send reply <'}</button></div>
        </form>
      </article>
    </> : <>
      <header className="msg-heading">
        <div><p className="msg-kicker">YOUR PALIXIA INBOX</p><h1>Messages</h1><p>Updates and conversations from the Palixia team.</p></div>
        <div className="msg-heading-icon" aria-hidden="true">✉</div>
      </header>
      {error && <p className="msg-error" role="alert">{error}</p>}
      <div className="msg-inbox-bar"><b>Inbox</b><span>{items.filter(item => !item.read_at).length ? items.filter(item => !item.read_at).length + ' unread' : 'All caught up'}</span></div>
      {busy ? <div className="msg-loading">Loading messages…</div> : !items.length ? <div className="msg-empty"><div className="msg-mark">✉</div><h2>Your inbox is quiet</h2><p>Messages from the Palixia team will appear here.</p></div> :
        <div className="msg-list">{items.map(row => <button key={row.id} type="button" onClick={() => openMessage(row)} className={'msg-card ' + (!row.read_at ? 'unread' : '')}>
          <div className="msg-avatar">P</div>
          <div className="msg-card-main">
            <div className="msg-card-top"><b>Palixia <span className="msg-official">OFFICIAL</span></b><time>{dateLabel(row.admin_messages.created_at)}</time></div>
            <strong>{row.admin_messages.subject}</strong>
            <p>{row.admin_messages.body.slice(0, 135)}{row.admin_messages.body.length > 135 ? '…' : ''}</p>
          </div>
          <div className="msg-card-end">{!row.read_at && <span className="msg-unread-dot" aria-label="Unread" />}<span aria-hidden="true">›</span></div>
        </button>)}</div>}
    </>}
    <MessageStyles />
  </section>;
}

function MessageStyles() {
  return <style jsx global>{`
    .msg-page{width:min(100%,820px);margin:0 auto;padding:clamp(1rem,3vw,2rem) 1rem 5rem;min-height:65vh;color:var(--fg)}
    .msg-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.35rem 0 1.35rem;border-bottom:1px solid var(--line)}
    .msg-heading h1{font-size:clamp(2rem,7vw,2.65rem);font-weight:850;letter-spacing:-.055em;line-height:1.05}
    .msg-heading p:not(.msg-kicker){margin-top:.5rem;color:var(--muted);font-size:.92rem}
    .msg-kicker{margin-bottom:.5rem;color:var(--accent);font:700 .68rem var(--mono);letter-spacing:.12em}
    .msg-heading-icon{display:grid;place-items:center;flex:none;width:3.4rem;height:3.4rem;border-radius:18px;background:var(--soft);color:var(--accent);font-size:1.55rem}
    .msg-inbox-bar{display:flex;justify-content:space-between;align-items:center;padding:1.15rem .1rem .65rem;font-size:.9rem}
    .msg-inbox-bar span{color:var(--muted);font-size:.78rem}
    .msg-list{display:grid;gap:.65rem}
    .msg-card{display:flex;align-items:flex-start;gap:.85rem;width:100%;min-width:0;padding:1rem;border:1px solid var(--line);border-radius:15px;background:var(--surface);color:var(--fg);text-align:left;transition:border-color .18s,transform .18s,box-shadow .18s}
    .msg-card:hover{border-color:var(--lav);box-shadow:0 7px 22px rgba(55,25,100,.07);transform:translateY(-1px)}
    .msg-card.unread{background:var(--soft);border-color:#d8c8f5}
    .msg-avatar{display:grid;place-items:center;flex:none;width:2.75rem;height:2.75rem;border-radius:50%;background:linear-gradient(145deg,#6d28d9,#35116e);color:white;font-weight:850;font-size:1.1rem;box-shadow:0 4px 12px #4c1d951c}
    .msg-card-main{min-width:0;flex:1;display:grid;gap:.3rem}
    .msg-card-top{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
    .msg-card-top b{font-size:.9rem}
    .msg-card time,.msg-thread-head time{color:var(--muted);font-size:.7rem;white-space:nowrap}
    .msg-official{margin-left:.3rem;color:var(--accent);font:700 .57rem var(--mono);letter-spacing:.07em}
    .msg-card strong{font-size:.96rem;line-height:1.35;overflow-wrap:anywhere}
    .msg-card p{color:var(--muted);font-size:.82rem;line-height:1.5;overflow-wrap:anywhere}
    .msg-card-end{display:flex;align-items:center;gap:.55rem;align-self:center;color:var(--muted);font-size:1.35rem}
    .msg-unread-dot{width:.55rem;height:.55rem;border-radius:50%;background:var(--accent)}
    .msg-empty{display:grid;justify-items:center;text-align:center;gap:.55rem;padding:3.2rem 1.2rem;border:1px dashed var(--line);border-radius:16px;background:var(--surface);margin-top:1rem}
    .msg-empty h1,.msg-empty h2{font-size:1.3rem;font-weight:800}
    .msg-empty p{max-width:20rem;color:var(--muted);font-size:.88rem}
    .msg-mark{display:grid;place-items:center;width:3.2rem;height:3.2rem;margin-bottom:.3rem;border-radius:50%;background:var(--soft);color:var(--accent);font-size:1.45rem}
    .msg-loading{padding:2rem 1rem;text-align:center;color:var(--muted)}
    .msg-topline{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
    .msg-back{display:flex;align-items:center;gap:.45rem;color:var(--accent);font-weight:700;font-size:.9rem;padding:.45rem 0}
    .msg-back span{font-size:1.2rem}
    .msg-secure{color:var(--muted);font:700 .62rem var(--mono);letter-spacing:.1em}
    .msg-thread{overflow:hidden;border:1px solid var(--line);border-radius:17px;background:var(--bg);box-shadow:0 8px 28px rgba(40,20,70,.045)}
    .msg-thread-head{display:flex;align-items:center;gap:.75rem;padding:1rem 1.1rem;background:var(--surface);border-bottom:1px solid var(--line)}
    .msg-avatar-large{width:2.8rem;height:2.8rem}
    .msg-thread-sender{display:grid;gap:.1rem;flex:1}
    .msg-thread-sender b{font-size:.92rem}
    .msg-thread-sender span{font-size:.75rem;color:var(--muted)}
    .msg-subject{padding:1.25rem 1.25rem .75rem;font-size:clamp(1.25rem,5vw,1.7rem);font-weight:850;letter-spacing:-.035em;line-height:1.2}
    .msg-original{padding:0 1.25rem 1.4rem;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75;font-size:.94rem}
    .msg-divider{display:flex;align-items:center;gap:.7rem;padding:0 1.25rem;color:var(--muted);font:700 .62rem var(--mono);letter-spacing:.1em}
    .msg-divider:after{content:"";height:1px;flex:1;background:var(--line)}
    .msg-replies{display:grid;gap:1rem;padding:1.2rem}
    .msg-bubble-wrap{display:grid;gap:.3rem;max-width:88%}
    .msg-bubble-wrap.from-you{justify-self:end;text-align:right}
    .msg-bubble-label{font:700 .6rem var(--mono);letter-spacing:.1em;color:var(--muted)}
    .msg-bubble{padding:.8rem .95rem;border:1px solid var(--line);border-radius:14px 14px 14px 4px;background:var(--surface);text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;font-size:.9rem}
    .from-you .msg-bubble{border-color:#d8c8f5;border-radius:14px 14px 4px 14px;background:var(--soft)}
    .msg-bubble-wrap time{font-size:.67rem;color:var(--muted)}
    .msg-first-reply{display:flex;gap:.65rem;align-items:center;padding:.8rem;border-radius:12px;background:var(--surface);color:var(--muted);font-size:.83rem}
    .msg-first-reply span{color:var(--accent);font-size:1.3rem}
    .msg-composer{position:sticky;bottom:calc(var(--nav-h,4.1rem) + .5rem);z-index:5;padding:.85rem;border-top:1px solid var(--line);background:var(--surface)}
    .msg-composer textarea{display:block;width:100%;resize:vertical;min-height:3.2rem;padding:.7rem .8rem;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg);outline-offset:2px}
    .msg-compose-foot{display:flex;justify-content:space-between;align-items:center;gap:.75rem;margin-top:.55rem}
    .msg-compose-foot small{color:var(--muted);font-size:.7rem}
    .msg-primary{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;padding:.7rem 1.05rem;border:0;border-radius:9px;background:var(--accent);color:white;font-weight:750;font-size:.86rem}
    .msg-primary:disabled{opacity:.55;cursor:wait}
    .msg-error{margin:.75rem 0;padding:.7rem .85rem;border:1px solid #f1c5d0;border-radius:10px;background:#fff4f6;color:#9f1239;font-size:.84rem}
    @media(max-width:420px){.msg-page{padding-inline:.75rem}.msg-card{gap:.65rem;padding:.8rem}.msg-avatar{width:2.45rem;height:2.45rem}.msg-card-top{align-items:flex-start;flex-direction:column;gap:.1rem}.msg-card time{font-size:.66rem}.msg-bubble-wrap{max-width:95%}.msg-thread-head{padding:.85rem}.msg-subject{padding-inline:1rem}.msg-original{padding-inline:1rem}}
    :root[data-theme="dark"] .msg-error{background:#351b2a;border-color:#713047;color:#fecdd3}
    @media(prefers-reduced-motion:reduce){.msg-card{transition:none}}
  `}</style>;
}
