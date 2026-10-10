'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fmtNum, typeLabel } from '@/lib/format';
import Guard from '@/components/Guard';
import Cover from '@/components/Cover';
import Empty from '@/components/Empty';

function Dashboard() {
  const { user, profile } = useAuth();
  const [books, setBooks] = useState(null);
  const [stats, setStats] = useState(null);
  const [saves, setSaves] = useState({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [b, s, sv] = await Promise.all([
        supabase.from('books').select('id,title,cover_url,book_type,status,story_status,reads,is_sample,chapters(id,status)').eq('author_id', user.id).order('updated_at', { ascending: false }),
        supabase.rpc('author_stats', { p_author: user.id }),
        supabase.rpc('book_saves'),
      ]);
      if (b.error) { setFailed(true); setBooks([]); return; }
      setBooks(b.data || []);
      setStats(s.data || null);
      const m = {};
      (sv.data || []).forEach((r) => { m[r.book_id] = Number(r.saves); });
      setSaves(m);
    })();
  }, [user]);

  const all = books || [];
  const totalReads = all.reduce((a, b) => a + (b.reads || 0), 0);
  const published = all.filter((b) => b.status === 'published').length;
  const first = (profile.name || '').split(' ')[0] || profile.name;

  return (
    <>
      <div className="stack">
        <h1 className="h1">Welcome back, {first}</h1>
        <div className="row">
          <Link className="btn" href="/dashboard/books/new">Create New Book</Link>
          <Link className="btn ghost" href={'/author/' + profile.username}>View public page</Link>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="mono">Total reads</span><b>{fmtNum(totalReads)}</b></div>
        <div className="stat"><span className="mono">Books</span><b>{all.length}</b></div>
        <div className="stat"><span className="mono">Published</span><b>{published}</b></div>
        <div className="stat"><span className="mono">Followers</span><b>{stats ? fmtNum(stats.followers) : '0'}</b></div>
      </div>
      <p className="fine">A read counts the first time a signed-in reader opens any chapter of your book.</p>

      {failed && <p className="notice">We could not load your books. Check your connection and refresh.</p>}
      {books === null && <p className="muted">Loading...</p>}

      {books && books.length === 0 && !failed && (
        <Empty title="You haven't published anything yet." text="Start with a title, a cover and a description, then add your first chapter." href="/dashboard/books/new" cta="Create Your First Book" />
      )}

      {books && books.length > 0 && (
        <section>
          <div className="sechead"><h2 className="h2">Your books</h2></div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Book</th><th>Format</th><th>Publishing</th><th>Story</th><th className="num">Chapters</th><th className="num">Reads</th><th className="num">Saves</th><th /></tr>
              </thead>
              <tbody>
                {books.map((b) => {
                  const live = (b.chapters || []).filter((c) => c.status === 'published').length;
                  return (
                    <tr key={b.id}>
                      <td><div className="tcell"><div style={{ width: '2.4rem' }}><Cover b={{ ...b, author_name: '' }} /></div><b style={{ overflowWrap: 'anywhere' }}>{b.title}</b></div></td>
                      <td>{typeLabel(b.book_type)}</td>
                      <td><span className={'badge ' + (b.status === 'published' ? 'live' : 'draft')}>{b.status === 'published' ? 'Published' : b.status === 'draft' ? 'Draft' : 'Unpublished'}</span></td>
                      <td><span className="badge">{b.story_status === 'completed' ? 'Completed' : b.story_status === 'hiatus' ? 'On hiatus' : 'Ongoing'}</span></td>
                      <td className="num">{live} / {(b.chapters || []).length}</td>
                      <td className="num">{fmtNum(b.reads)}</td>
                      <td className="num">{saves[b.id] || 0}</td>
                      <td><Link className="btn ghost small" href={'/dashboard/books/' + b.id}>Manage</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="fine" style={{ marginTop: '0.5rem' }}>Chapters shows published / total.</p>
        </section>
      )}
    </>
  );
}

export default function DashboardPage() {
  return <Guard roles={['author', 'admin']}><Dashboard /></Guard>;
}
