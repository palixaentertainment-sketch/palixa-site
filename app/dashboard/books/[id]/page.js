'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendly } from '@/lib/errors';
import { fmtNum } from '@/lib/format';
import Guard from '@/components/Guard';
import BookForm from '@/components/BookForm';
import Empty from '@/components/Empty';

function Manage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const [book, setBook] = useState(undefined);
  const [chapters, setChapters] = useState([]);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('books')
      .select('id,author_id,title,description,cover_url,genre_id,tags,book_type,status,story_status,reads,is_sample')
      .eq('id', id).maybeSingle();
    if (!data || data.author_id !== user.id) { setBook(null); return; }
    setBook(data);
    const { data: chs } = await supabase.from('chapters').select('id,chapter_number,title,status,reads').eq('book_id', id).order('chapter_number');
    setChapters(chs || []);
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(status) {
    setMsg('');
    const { error } = await supabase.from('books').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { setMsg(friendly(error)); return; }
    await load();
    setFormKey((k) => k + 1);
  }

  async function removeBook() {
    setMsg('');
    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) { setMsg(friendly(error, 'We could not delete this book.')); return; }
    router.push('/dashboard');
  }

  async function removeChapter(cid) {
    setMsg('');
    const { error } = await supabase.from('chapters').delete().eq('id', cid);
    if (error) { setMsg(friendly(error, 'We could not delete this chapter.')); return; }
    setConfirm('');
    await load();
  }

  async function toggleChapter(c) {
    setMsg('');
    const status = c.status === 'published' ? 'draft' : 'published';
    const { error } = await supabase.from('chapters').update({ status, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) { setMsg(friendly(error)); return; }
    await load();
  }

  if (book === undefined) return <p className="muted">Loading...</p>;
  if (book === null) return <Empty title="We could not find that book." text="It may not be yours, or it may have been deleted." href="/dashboard" cta="Back to dashboard" />;

  const live = chapters.filter((c) => c.status === 'published').length;

  return (
    <>
      <div className="stack">
        <Link className="linkbtn" href="/dashboard">&larr; Dashboard</Link>
        <div className="row between">
          <h1 className="h1" style={{ overflowWrap: 'anywhere' }}>{book.title}</h1>
          <span className={'badge ' + (book.status === 'published' ? 'live' : 'draft')}>{book.status === 'published' ? 'Published' : book.status === 'draft' ? 'Draft' : 'Unpublished'}</span>
        </div>
        <dl className="facts">
          <div><dt>Reads</dt><dd>{fmtNum(book.reads)}</dd></div>
          <div><dt>Chapters</dt><dd>{live} live of {chapters.length}</dd></div>
          <div><dt>Format</dt><dd>{book.book_type === 'comic' ? 'Comic' : 'Text book'}</dd></div>
          <div><dt>Story</dt><dd>{({ ongoing: 'Ongoing', completed: 'Completed', hiatus: 'On hiatus' })[book.story_status] || 'Ongoing'}</dd></div>
        </dl>
        <div className="row">
          <Link className="btn ghost" href={'/book/' + book.id}>View</Link>
          {book.status === 'published' ? (
            <button type="button" className="btn ghost" onClick={() => setStatus('unpublished')}>Unpublish</button>
          ) : (
            <button type="button" className="btn" onClick={() => setStatus('published')}>Publish</button>
          )}
        </div>
        {book.status !== 'published' && live === 0 && <p className="fine">Publish at least one chapter so readers have something to read.</p>}
        {msg && <p className="msg-err" role="alert">{msg}</p>}
      </div>

      <section className="stack">
        <div className="sechead" style={{ marginBottom: 0 }}>
          <h2 className="h2">Chapters</h2>
          <Link className="btn small" href={'/dashboard/books/' + book.id + '/chapters/new'}>Add Chapter</Link>
        </div>
        {chapters.length === 0 ? (
          <Empty title="No chapters yet." text={book.book_type === 'comic' ? 'Upload your first chapter as a set of page images.' : 'Write or paste your first chapter.'} href={'/dashboard/books/' + book.id + '/chapters/new'} cta="Add Chapter" />
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th className="num">No.</th><th>Title</th><th>Status</th><th className="num">Reads</th><th /></tr></thead>
              <tbody>
                {chapters.map((c) => (
                  <tr key={c.id}>
                    <td className="num">{c.chapter_number}</td>
                    <td style={{ overflowWrap: 'anywhere', minWidth: '9rem' }}>{c.title}</td>
                    <td><span className={'badge ' + (c.status === 'published' ? 'live' : 'draft')}>{c.status === 'published' ? 'Published' : 'Draft'}</span></td>
                    <td className="num">{fmtNum(c.reads)}</td>
                    <td>
                      {confirm === c.id ? (
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <button type="button" className="btn danger small" onClick={() => removeChapter(c.id)}>Delete chapter</button>
                          <button type="button" className="btn ghost small" onClick={() => setConfirm('')}>Cancel</button>
                        </div>
                      ) : (
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <Link className="btn ghost small" href={'/dashboard/books/' + book.id + '/chapters/' + c.id}>Edit</Link>
                          <button type="button" className="btn ghost small" onClick={() => toggleChapter(c)}>{c.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                          <button type="button" className="btn ghost small" onClick={() => setConfirm(c.id)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack narrow">
        <h2 className="h2">Book details</h2>
        <BookForm key={formKey} userId={user.id} book={book} locked={chapters.length > 0} onSaved={load} />
      </section>

      <section className="card narrow">
        <h2 className="h2">Delete this book</h2>
        <p className="muted">This permanently removes the book, its chapters and its reading data. This cannot be undone.</p>
        {confirm === 'book' ? (
          <div className="row">
            <button type="button" className="btn danger" onClick={removeBook}>Yes, delete this book</button>
            <button type="button" className="btn ghost" onClick={() => setConfirm('')}>Cancel</button>
          </div>
        ) : (
          <div><button type="button" className="btn danger" onClick={() => setConfirm('book')}>Delete book</button></div>
        )}
      </section>
    </>
  );
}

export default function ManagePage() {
  return <Guard roles={['author', 'admin']}><Manage /></Guard>;
}
