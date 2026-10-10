'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendly } from '@/lib/errors';
import { checkImage, uploadImage } from '@/lib/upload';
import Guard from '@/components/Guard';
import Empty from '@/components/Empty';

const MAX_PAGES = 60;

function Editor() {
  const { id, chapterId } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const isNew = chapterId === 'new';

  const [book, setBook] = useState(undefined);
  const [chapter, setChapter] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [items, setItems] = useState([]); // comic pages: { key, url, file? }
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('books').select('id,title,author_id,book_type,status').eq('id', id).maybeSingle();
      if (!b || b.author_id !== user.id) { setBook(null); return; }
      setBook(b);
      if (isNew) { if (b.book_type === 'poem') setTitle(b.title); return; }
      const { data: c } = await supabase.from('chapters').select('id,book_id,chapter_number,title,content,status').eq('id', chapterId).maybeSingle();
      if (!c || c.book_id !== b.id) { setBook(null); return; }
      setChapter(c);
      setTitle(c.title);
      setContent(c.content || '');
      if (b.book_type === 'comic') {
        const { data: pg } = await supabase.from('chapter_pages').select('id,page_number,image_url').eq('chapter_id', c.id).order('page_number');
        setItems((pg || []).map((p) => ({ key: p.id, url: p.image_url })));
      }
    })();
  }, [id, chapterId, isNew, user]);

  useEffect(() => () => { items.forEach((i) => { if (i.file) URL.revokeObjectURL(i.url); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function addFiles(e) {
    setErr('');
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (items.length + files.length > MAX_PAGES) { setErr('A chapter can have up to ' + MAX_PAGES + ' pages.'); return; }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const f of files) {
      const problem = checkImage(f, 3);
      if (problem) { setErr(f.name + ': ' + problem.replace('2 MB', '3 MB')); return; }
    }
    setItems((cur) => [...cur, ...files.map((f) => ({ key: 'n' + Date.now() + Math.random().toString(36).slice(2, 6), url: URL.createObjectURL(f), file: f }))]);
  }

  function move(i, d) {
    setItems((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = cur.slice();
      const t = next[i]; next[i] = next[j]; next[j] = t;
      return next;
    });
  }
  function drop(i) { setItems((cur) => cur.filter((_, k) => k !== i)); }

  async function save(status) {
    setErr(''); setOk('');
    const isComic = book.book_type === 'comic';
    const isPoem = book.book_type === 'poem';
    if (!title.trim()) { setErr(isPoem ? 'Give your poem a title.' : 'Give the chapter a title.'); return; }
    if (status === 'published') {
      if (!isComic && !content.trim()) { setErr(isPoem ? 'Write your poem before publishing.' : 'Write some text before publishing this chapter.'); return; }
      if (isComic && items.length === 0) { setErr('Add at least one page image before publishing.'); return; }
    }
    setBusy(true);
    try {
      let cid = chapter ? chapter.id : null;
      const finalStatus = status || (chapter ? chapter.status : 'draft');
      if (!cid) {
        const { data: last } = await supabase.from('chapters').select('chapter_number').eq('book_id', book.id).order('chapter_number', { ascending: false }).limit(1);
        const number = last && last[0] ? last[0].chapter_number + 1 : 1;
        const { data, error } = await supabase.from('chapters')
          .insert({ book_id: book.id, chapter_number: number, title: title.trim(), content: isComic ? null : content, status: finalStatus })
          .select('id,book_id,chapter_number,title,content,status').single();
        if (error) throw error;
        cid = data.id;
        setChapter(data);
      } else {
        const { error } = await supabase.from('chapters')
          .update({ title: title.trim(), content: isComic ? null : content, status: finalStatus, updated_at: new Date().toISOString() })
          .eq('id', cid);
        if (error) throw error;
      }
      if (isComic) {
        const urls = [];
        for (const it of items) {
          urls.push(it.file ? await uploadImage('pages', user.id, it.file, book.id + '/' + cid) : it.url);
        }
        const { error: delErr } = await supabase.from('chapter_pages').delete().eq('chapter_id', cid);
        if (delErr) throw delErr;
        if (urls.length > 0) {
          const { error: insErr } = await supabase.from('chapter_pages').insert(
            urls.map((u, n) => ({ chapter_id: cid, page_number: n + 1, image_url: u, alt: 'Page ' + (n + 1) }))
          );
          if (insErr) throw insErr;
        }
        setItems((cur) => cur.map((it, n) => {
          if (it.file) URL.revokeObjectURL(it.url);
          return { key: 'p' + n + '-' + cid, url: urls[n] };
        }));
      }
      setChapter((c) => (c ? { ...c, status: finalStatus } : c));
      setOk(finalStatus === 'published' ? (isPoem ? 'Poem published.' : 'Chapter published.') : 'Draft saved.');
      if (isNew) router.replace('/dashboard/books/' + book.id + '/chapters/' + cid);
    } catch (e) {
      setErr(friendly(e, 'We could not save this chapter. Your work is still on this page, so try again.'));
    }
    setBusy(false);
  }

  if (book === undefined) return <p className="muted">Loading...</p>;
  if (book === null) return <Empty title="We could not find that chapter." href="/dashboard" cta="Back to dashboard" />;

  const isComic = book.book_type === 'comic';
  const published = chapter && chapter.status === 'published';

  return (
    <div className="stack" style={{ maxWidth: '46rem' }}>
      <Link className="linkbtn" href={'/dashboard/books/' + book.id}>&larr; {book.title}</Link>
      <div className="row between">
        <h1 className="h1">{book.book_type === 'poem' ? (chapter ? 'Edit poem' : 'Write a poem') : chapter ? 'Chapter ' + chapter.chapter_number : 'New chapter'}</h1>
        {chapter && <span className={'badge ' + (published ? 'live' : 'draft')}>{published ? 'Published' : 'Draft'}</span>}
      </div>

      <div className="card">
        <div className="field">
          <label htmlFor="c-title">{book.book_type === 'poem' ? 'Poem title' : 'Chapter title'}</label>
          <input id="c-title" className="in" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>

        {isComic ? (
          <div className="field">
            <label htmlFor="c-pages">Page images</label>
            <input id="c-pages" className="in" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addFiles} />
            <span className="fine">Files are added in file-name order, so name them 01, 02, 03. Reorder below if needed. JPG, PNG or WebP, up to 3 MB each, up to {MAX_PAGES} pages. Narrow, tall images read best on phones.</span>
            {items.length === 0 ? (
              <p className="empty">No pages yet. Choose images above.</p>
            ) : (
              <ol className="mlist">
                {items.map((it, i) => (
                  <li key={it.key}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.url} alt={'Page ' + (i + 1) + ' preview'} style={{ width: '3.4rem', height: '4.6rem', objectFit: 'cover', borderRadius: 4, background: 'var(--soft)' }} />
                    <div>
                      <b>Page {i + 1}</b>{it.file ? <span className="fine"> &middot; {it.file.name}</span> : null}
                      <div className="acts">
                        <button type="button" className="btn ghost small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={'Move page ' + (i + 1) + ' up'}>Up</button>
                        <button type="button" className="btn ghost small" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={'Move page ' + (i + 1) + ' down'}>Down</button>
                        <button type="button" className="btn ghost small" onClick={() => drop(i)}>Remove</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          <div className="field">
            <label htmlFor="c-body">{book.book_type === 'poem' ? 'Your poem' : 'Chapter text'}</label>
            <textarea id="c-body" className="in tall" value={content} onChange={(e) => setContent(e.target.value)} placeholder={book.book_type === 'poem' ? 'Write your poem here. Keep the line breaks as you want readers to see them.' : 'Write or paste your chapter here. Leave a blank line between paragraphs.'} />
            <span className="fine">{content.trim() ? content.trim().split(/\s+/).length.toLocaleString() : 0} words</span>
          </div>
        )}

        <p className="msg-err" role="alert">{err}</p>
        {ok && <p className="msg-ok" role="status">{ok}</p>}
        <div className="row">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => save(published ? 'published' : 'draft')}>{busy ? 'Saving...' : published ? 'Save changes' : 'Save Draft'}</button>
          {!published && <button type="button" className="btn" disabled={busy} onClick={() => save('published')}>{book.book_type === 'poem' ? 'Publish Poem' : 'Publish Chapter'}</button>}
          {published && <button type="button" className="btn ghost" disabled={busy} onClick={() => save('draft')}>Unpublish</button>}
          {chapter && <Link className="btn ghost" href={'/read/' + chapter.id}>Preview</Link>}
        </div>
      </div>
    </div>
  );
}

export default function ChapterEditorPage() {
  return <Guard roles={['author', 'admin']}><Editor /></Guard>;
}
