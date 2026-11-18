'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function dateLabel(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || !configured) { setItems([]); setBusy(false); return; }
    setBusy(true);
    const { data, error: queryError } = await supabase
      .from('admin_message_recipients')
      .select('id,read_at,created_at,admin_messages!admin_message_recipients_message_id_fkey(id,subject,body,created_at)')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (queryError) {
      setError('Messages are not enabled yet. Ask the Palixia administrator to run supabase/admin-messages.sql in the Supabase SQL Editor.');
      setItems([]);
    } else {
      setError('');
      setItems((data || []).filter(row => row.admin_messages));
    }
    setBusy(false);
  }, [user]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  async function openMessage(row) {
    setSelected(row);
    if (!row.read_at) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase.from('admin_message_recipients')
        .update({ read_at: now }).eq('id', row.id).eq('recipient_id', user.id);
      if (!updateError) {
        setItems(current => current.map(item => item.id === row.id ? { ...item, read_at: now } : item));
        setSelected(current => current && current.id === row.id ? { ...current, read_at: now } : current);
      }
    }
  }

  if (loading) return <section className="stack"><h1 className="h1">Messages</h1><p className="muted">Loading…</p></section>;
  if (!user) return <section className="stack"><h1 className="h1">Messages</h1><p>Log in to view your messages.</p><Link className="btn" href="/login">Log in</Link></section>;

  return <section className="stack" style={{ maxWidth: 820, margin: '0 auto', gap: '1rem' }}>
    <div className="sechead"><h1 className="h1">Messages</h1></div>
    {error && <p className="notice" role="alert">{error}</p>}
    {selected ? <article className="panel stack" style={{ padding: '1.2rem', gap: '.85rem' }}>
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start', width: 'fit-content' }} onClick={() => setSelected(null)}>← Back to messages</button>
      <div><span className="badge">Official Palixia</span><h2 className="h2" style={{ marginTop: '.65rem' }}>{selected.admin_messages.subject}</h2><p className="fine">{dateLabel(selected.admin_messages.created_at)}</p></div>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{selected.admin_messages.body}</div>
    </article> : <>
      {busy && <p className="muted">Loading messages…</p>}
      {!busy && !error && items.length === 0 && <div className="empty" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div aria-hidden="true" style={{ color: 'var(--accent)', fontSize: '2.4rem', marginBottom: '.75rem' }}>✉</div>
        <h2 className="h2">You have no messages yet.</h2>
        <p className="muted">Messages from the Palixia team will appear here.</p>
      </div>}
      <div className="stack" style={{ gap: '.55rem' }}>
        {items.map(row => <button key={row.id} type="button" onClick={() => openMessage(row)} className="panel" style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '.85rem', padding: '1rem', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 12, background: row.read_at ? 'var(--surface)' : 'var(--soft)', color: 'var(--fg)', cursor: 'pointer' }}>
          <span aria-hidden="true" style={{ color: 'var(--accent)', fontSize: '1.5rem' }}>✉</span>
          <span style={{ minWidth: 0, flex: 1 }}><b style={{ display: 'block' }}>Palixia</b><span style={{ display: 'block', fontWeight: row.read_at ? 500 : 800 }}>{row.admin_messages.subject}</span><small className="muted">{row.admin_messages.body.slice(0, 110)}{row.admin_messages.body.length > 110 ? '…' : ''}</small><small className="muted" style={{ display: 'block', marginTop: '.25rem' }}>{dateLabel(row.admin_messages.created_at)}</small></span>
          {!row.read_at && <span aria-label="Unread" style={{ width: 9, height: 9, flex: '0 0 9px', borderRadius: '50%', background: 'var(--accent)' }} />}
          <span aria-hidden="true" className="muted">›</span>
        </button>)}
      </div>
    </>}
  </section>;
}
