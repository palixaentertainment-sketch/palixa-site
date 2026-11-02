'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Guard from '@/components/Guard';

function NewsletterAdminPanel() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase.rpc('admin_list_palixia_letter_subscribers');
    if (queryError) {
      setError(queryError.code === '42883'
        ? 'Newsletter admin database setup is missing. Run the Palixia Letters migrations in Supabase, then refresh.'
        : 'Could not load newsletter subscribers. Confirm you are signed in with an active admin account and that the Palixia Letters admin migration has been applied.');
      setSubscribers([]);
    } else {
      setSubscribers(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCount = subscribers.filter(s => !s.unsubscribed_at).length;
  const unsubscribedCount = subscribers.length - activeCount;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers.filter(s => {
      const isActive = !s.unsubscribed_at;
      if (filter === 'active' && !isActive) return false;
      if (filter === 'unsubscribed' && isActive) return false;
      if (q && ![s.email, s.subscriber_type, s.source].some(v => String(v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [subscribers, filter, search]);

  return (
    <div className="stack">
      <div className="stack">
        <Link className="linkbtn" href="/admin">← Back to admin dashboard</Link>
        <p className="mono">Palixia administration</p>
        <h1 className="h1">Palixia Letters</h1>
        <p className="muted">View people who chose to receive Palixia updates. Only active subscribers should be included in future campaigns.</p>
      </div>

      {error && <p className="msg-err" role="alert">{error}</p>}

      <div className="stats">
        <div className="stat"><span className="mono">Total records</span><b>{loading ? '—' : subscribers.length.toLocaleString()}</b></div>
        <div className="stat"><span className="mono">Active subscribers</span><b>{loading ? '—' : activeCount.toLocaleString()}</b></div>
        <div className="stat"><span className="mono">Unsubscribed</span><b>{loading ? '—' : unsubscribedCount.toLocaleString()}</b></div>
      </div>

      <section className="stack">
        <div className="sechead">
          <h2 className="h2">Subscriber list</h2>
          <button className="btn ghost small" type="button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        <p className="fine">Email addresses are private account data. Do not export or share this list. Sending newsletters is not enabled yet.</p>
        <div className="field">
          <label htmlFor="letters-filter">Subscription status</label>
          <select id="letters-filter" className="in" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="active">Active subscribers</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="all">All records</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="letters-search">Search subscribers</label>
          <input id="letters-search" className="in" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Email, reader, author or source" />
        </div>
        {loading ? <p className="muted">Loading subscribers…</p> : <div className="tablewrap">
          <table>
            <thead><tr><th>Email</th><th>Type</th><th>Source</th><th>Subscribed</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((s, i) => <tr key={s.email || i}>
                <td>{s.email}</td>
                <td style={{textTransform:'capitalize'}}>{s.subscriber_type}</td>
                <td style={{textTransform:'capitalize'}}>{s.source}</td>
                <td>{s.consent_at ? new Date(s.consent_at).toLocaleDateString() : '—'}</td>
                <td><span className="badge">{s.unsubscribed_at ? 'Unsubscribed' : 'Active'}</span></td>
              </tr>)}
              {filtered.length === 0 && <tr><td colSpan="5">No subscribers match this view.</td></tr>}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  );
}

export default function NewsletterAdminPage() {
  return <Guard roles={['admin']}><NewsletterAdminPanel /></Guard>;
}
