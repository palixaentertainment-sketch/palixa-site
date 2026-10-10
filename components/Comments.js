'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function ago(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' h ago';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function Composer({ placeholder, onSend, onCancel, initial = '', cta = 'Post' }) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) { setError('Write something first.'); return; }
    setBusy(true); setError('');
    const issue = await onSend(body.trim());
    setBusy(false);
    if (issue) setError(issue); else setBody('');
  }
  return <form className="cform" onSubmit={submit}>
    <textarea className="in" aria-label="Comment" maxLength={1000} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} />
    {error && <p className="msg-err" role="alert">{error}</p>}
    <span className="row"><button className="btn small" disabled={busy}>{busy ? 'Saving...' : cta}</button>{onCancel && <button className="btn ghost small" type="button" onClick={onCancel}>Cancel</button>}</span>
  </form>;
}
export default function Comments({ chapterId, authorId }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState('');
  const [reportingId, setReportingId] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('comments')
      .select('id,user_id,parent_id,body,status,created_at,updated_at,profiles(name,username)')
      .eq('chapter_id', chapterId).order('created_at', { ascending: true }).limit(200);
    if (error) { setFailed(true); setRows([]); return; }
    setFailed(false);
    setRows((data || []).filter((c) => c.status === 'visible' || (user && c.user_id === user.id)));
  }, [chapterId, user]);
  useEffect(() => { setRows(null); load(); }, [load]);
  async function post(body, parentId = null) {
    if (!user) return 'Log in to comment.';
    const { error } = await supabase.from('comments').insert({ chapter_id: chapterId, user_id: user.id, parent_id: parentId, body });
    if (error) return /too_many_comments/i.test(error.message || '') ? 'You are posting too quickly. Please wait a minute.' : 'Could not post this comment. Please try again.';
    setReplyTo(null); await load(); return '';
  }
  async function saveEdit(id, body) {
    const { error } = await supabase.from('comments').update({ body: body.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return 'Could not edit this comment. Please try again.';
    setEditing(null); await load(); return '';
  }
  async function report(item) {
    const reason = typeof window !== 'undefined' ? window.prompt('Why are you reporting this comment?') : '';
    if (reason === null) return;
    if (!reason || reason.trim().length < 3) { setNote('Please enter a short reason for the report.'); return; }
    setReportingId(item.id); setNote('');
    const { error } = await supabase.rpc('submit_moderation_report', { p_target_type: 'chapter_comment', p_target_id: item.id, p_reason: reason.trim() });
    setReportingId('');
    if (error) setNote(error.message === 'duplicate key value violates unique constraint' ? 'You have already reported this item.' : 'Could not submit report. Please try again.');
    else setNote('Report sent to the Palixia moderation team.');
  }
  async function remove(id) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this comment?')) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) { setNote('Could not delete this comment. Please try again.'); return; }
    setNote(''); await load();
  }
  const tops = (rows || []).filter((c) => !c.parent_id);
  const children = (id) => (rows || []).filter((c) => c.parent_id === id);
  function Item({ item, reply = false }) {
    const mine = user && item.user_id === user.id;
    const canDelete = mine || (user && user.id === authorId);
    const profile = item.profiles;
    return <li className={'comment' + (reply ? ' reply' : '')}>
      <p className="chead">{profile ? <Link className="linkbtn" href={'/author/' + profile.username}>{profile.name}</Link> : <b>Reader</b>}{item.user_id === authorId && <span className="badge">Author</span>}<span className="fine">{ago(item.created_at)}{item.updated_at && new Date(item.updated_at) - new Date(item.created_at) > 1000 ? ' (edited)' : ''}</span></p>
      {editing === item.id ? <Composer initial={item.body} cta="Save" placeholder={'Edit comment'} onSend={(t) => saveEdit(item.id, t)} onCancel={() => setEditing(null)} /> : <p className="cbody">{item.body}</p>}
      {editing !== item.id && <p className="cact">
        {user && !reply && <button className="linkbtn fine" type="button" onClick={() => setReplyTo(replyTo === item.id ? null : item.id)}>Reply</button>}
        {mine && <button className="linkbtn fine" type="button" onClick={() => setEditing(item.id)}>Edit</button>}
        {canDelete && <button className="linkbtn fine" type="button" onClick={() => remove(item.id)}>Delete</button>}
        {user && !mine && <button className="linkbtn fine" type="button" disabled={reportingId === item.id} onClick={() => report(item)}>{reportingId === item.id ? 'Reporting…' : 'Report'}</button>}
      </p>}
      {replyTo === item.id && <Composer placeholder="Write a reply" cta="Reply" onSend={(t) => post(t, item.id)} onCancel={() => setReplyTo(null)} />}
      {!reply && children(item.id).length > 0 && <ul className="clist">{children(item.id).map((child) => <Item key={child.id} item={child} reply />)}</ul>}
    </li>;
  }
  const total = rows ? rows.length : 0;
  return <section className="comments" aria-label="Comments">
    <h2 className="h2">Comments{total ? ' (' + total + ')' : ''}</h2>
    {user ? <Composer placeholder="Share what you thought of this chapter" onSend={(t) => post(t)} /> : <p className="fine"><Link className="linkbtn" href={'/login?next=' + encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}>Log in</Link> to join the conversation.</p>}
    {note && <p className="msg-err" role="alert">{note}</p>}
    {failed && <p className="fine">Comments could not load right now.</p>}
    {rows === null && <p className="fine">Loading comments...</p>}
    {rows && rows.length === 0 && !failed && <p className="fine">No comments yet. Be the first.</p>}
    {tops.length > 0 && <ul className="clist">{tops.map((item) => <Item key={item.id} item={item} />)}</ul>}
  </section>;
}
