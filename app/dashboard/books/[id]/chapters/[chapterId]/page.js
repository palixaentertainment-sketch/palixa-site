'use client';
import { useEffect, useRef, useState } from 'react';
import { cleanRichHtml, richTextToEditorHtml, richTextWordCount } from '@/lib/richText';
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
  const [scheduledAt, setScheduledAt] = useState('');
  const [items, setItems] = useState([]); // comic pages: { key, url, file? }
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [wordGoal, setWordGoal] = useState(1500);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('');
  const editorRef = useRef(null);
  const editVersion = useRef(0);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('books').select('id,title,author_id,book_type,status').eq('id', id).maybeSingle();
      if (!b || b.author_id !== user.id) { setBook(null); return; }
      setBook(b);
      try { setWordGoal(Number(localStorage.getItem('palixia-word-goal') || 1500)); setNotes(localStorage.getItem('palixia-book-notes-' + b.id) || ''); } catch {}
      if (isNew) return;
      const { data: c } = await supabase.from('chapters').select('id,book_id,chapter_number,title,content,status,scheduled_at').eq('id', chapterId).maybeSingle();
      if (!c || c.book_id !== b.id) { setBook(null); return; }
      setChapter(c);
      setTitle(c.title);
      setContent(c.content || '');
      setDirty(false);
      setSaveState('');
      setScheduledAt(c.scheduled_at ? new Date(new Date(c.scheduled_at).getTime() - new Date(c.scheduled_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
      if (b.book_type === 'comic') {
        const { data: pg } = await supabase.from('chapter_pages').select('id,page_number,image_url').eq('chapter_id', c.id).order('page_number');
        setItems((pg || []).map((p) => ({ key: p.id, url: p.image_url })));
      }
    })();
  }, [id, chapterId, isNew, user]);

  useEffect(() => () => { items.forEach((i) => { if (i.file) URL.revokeObjectURL(i.url); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editorRef.current || preview || document.activeElement === editorRef.current) return;
    editorRef.current.innerHTML = richTextToEditorHtml(content);
  }, [content, preview]);

  // Existing drafts are quietly saved after the author pauses typing. Published chapters are never autosaved.
  useEffect(() => {
    if (!dirty || !chapter || chapter.status !== 'draft' || book?.book_type === 'comic') return undefined;
    setSaveState('Saving…');
    const timer = setTimeout(async () => {
      const version = editVersion.current;
      const { error } = await supabase.from('chapters').update({ content: cleanRichHtml(content), updated_at: new Date().toISOString() }).eq('id', chapter.id).eq('status', 'draft');
      if (error) setSaveState('Autosave failed — use Save Draft.');
      else if (version === editVersion.current) { setDirty(false); setSaveState('All changes saved'); }
    }, 1600);
    return () => clearTimeout(timer);
  }, [content, dirty, chapter, book]);

  function format(command, value) {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    const next = cleanRichHtml(editorRef.current.innerHTML);
    editVersion.current += 1;
    setContent(next);
    setDirty(true);
    setSaveState('Unsaved changes');
  }

  function insertSceneBreak() {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, '<p class="writer-scene-break">* * *</p><p><br></p>');
    handleEditorInput();
  }

  function handleEditorInput() {
    if (!editorRef.current) return;
    editVersion.current += 1;
    setContent(cleanRichHtml(editorRef.current.innerHTML));
    setDirty(true);
    setSaveState('Unsaved changes');
  }

  function addFiles(e) {
    setErr('');
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (items.length + files.length > MAX_PAGES) { setErr('A chapter can have up to ' + MAX_PAGES + ' pages.'); return; }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const f of files) {
      const problem = checkImage(f, 12);
      if (problem) { setErr(f.name + ': ' + problem); return; }
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
    const safeContent = isComic ? null : cleanRichHtml(content);
    if (!title.trim()) { setErr('Give the chapter a title.'); return; }
    if (status === 'published' || status === 'scheduled') {
      if (!isComic && !richTextWordCount(safeContent)) { setErr('Write some text before publishing this chapter.'); return; }
      if (isComic && items.length === 0) { setErr('Add at least one page image before publishing.'); return; }
    }
    setBusy(true);
    try {
      let cid = chapter ? chapter.id : null;
      const finalStatus = status || (chapter ? chapter.status : 'draft');
      if (finalStatus === 'scheduled' && (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime()) || new Date(scheduledAt).getTime() <= Date.now())) { setErr('Choose a future date and time for publishing.'); setBusy(false); return; }
      const scheduledIso = finalStatus === 'scheduled' ? new Date(scheduledAt).toISOString() : null;
      if (!cid) {
        const { data: last } = await supabase.from('chapters').select('chapter_number').eq('book_id', book.id).order('chapter_number', { ascending: false }).limit(1);
        const number = last && last[0] ? last[0].chapter_number + 1 : 1;
        const { data, error } = await supabase.from('chapters')
          .insert({ book_id: book.id, chapter_number: number, title: title.trim(), content: safeContent, status: finalStatus, scheduled_at: scheduledIso })
          .select('id,book_id,chapter_number,title,content,status,scheduled_at').single();
        if (error) throw error;
        cid = data.id;
        setChapter(data);
      } else {
        const { error } = await supabase.from('chapters')
          .update({ title: title.trim(), content: safeContent, status: finalStatus, scheduled_at: scheduledIso, updated_at: new Date().toISOString() })
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
      setChapter((c) => (c ? { ...c, status: finalStatus, scheduled_at: scheduledIso } : c));
      setDirty(false);
      setSaveState('All changes saved');
      setOk(finalStatus === 'published' ? 'Chapter published.' : finalStatus === 'scheduled' ? 'Chapter scheduled for automatic release.' : 'Draft saved.');
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
  const scheduled = chapter && chapter.status === 'scheduled';
  const wordCount = richTextWordCount(content);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className={"stack writer-page" + (focusMode ? " writer-focus-mode" : "")}>
      <Link className="linkbtn" href={'/dashboard/books/' + book.id}>&larr; {book.title}</Link>
      <div className="row between">
        <div><h1 className="h1">{chapter ? 'Chapter ' + chapter.chapter_number : 'New chapter'}</h1><p className="fine">{book.title}</p></div>
        {chapter && <span className={'badge ' + (published ? 'live' : 'draft')}>{published ? 'Published' : scheduled ? 'Scheduled' : 'Draft'}</span>}
      </div>

      <div className="writer-studio">
        <div className="field writer-title-field">
          <label htmlFor="c-title">Chapter title</label>
          <input id="c-title" className="in" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>

        {isComic ? (
          <div className="field">
            <label htmlFor="c-pages">Page images</label>
            <input id="c-pages" className="in" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addFiles} />
            <span className="fine">Files are added in file-name order, so name them 01, 02, 03. Reorder below if needed. JPG, PNG or WebP, up to 12 MB each before automatic compression, up to {MAX_PAGES} pages. Palixia optimizes page images for faster reading. Narrow, tall images read best on phones.</span>
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
          <div className="field writer-writing-field">
            <div className="row between writer-writing-meta">
              <label htmlFor="c-body">Your writing</label>
              <div className="writer-live-stats"><span>{wordCount.toLocaleString()} words</span><span>About {readingMinutes} min read</span></div>
            </div>
            <div className="writer-goal-row"><label htmlFor="writer-goal">Chapter word goal</label><input id="writer-goal" className="in" type="number" min="100" max="20000" step="100" value={wordGoal} onChange={(e) => { const v=Math.max(100,Math.min(20000,Number(e.target.value)||100)); setWordGoal(v); try { localStorage.setItem('palixia-word-goal',String(v)); } catch {} }} /><span>{Math.min(100,Math.round(wordCount / Math.max(1,wordGoal) * 100))}%</span></div>
            <div className="writer-goal-track"><span style={{width: Math.min(100,wordCount / Math.max(1,wordGoal) * 100) + '%'}} /></div>
            <div className="writer-toolbar" role="toolbar" aria-label="Text formatting">
              <button type="button" className="btn ghost small writer-tool" title="Bold" aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => format('bold')}><b>B</b></button>
              <button type="button" className="btn ghost small writer-tool" title="Italic" aria-label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => format('italic')}><i>I</i></button>
              <button type="button" className="btn ghost small writer-tool" title="Underline" aria-label="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => format('underline')}><u>U</u></button>
              <span className="writer-divider" aria-hidden="true" />
              <button type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('formatBlock', 'h2')}>Heading</button>
              <button type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('formatBlock', 'h3')}>Subheading</button>
              <button type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('insertUnorderedList')}>• List</button>
              <button type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('insertOrderedList')}>1. List</button>
              <button type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('formatBlock', 'blockquote')}>Quote</button>
              <button type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={insertSceneBreak}>Scene break</button>
              <span className="writer-divider" aria-hidden="true" />
              <button type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('undo')}>Undo</button>
              <button type="button" className="btn ghost small" onMouseDown={(e) => e.preventDefault()} onClick={() => format('redo')}>Redo</button>
            </div>
            {preview ? (
              <div className="writer-preview" aria-label="Chapter preview">
                <div className="row between"><b>Preview</b><button type="button" className="linkbtn" onClick={() => setPreview(false)}>Back to editing</button></div>
                <div className="writer-preview-content" dangerouslySetInnerHTML={{ __html: cleanRichHtml(content) || '<p>Your chapter preview will appear here.</p>' }} />
              </div>
            ) : (
              <div
                id="c-body"
                ref={editorRef}
                className="writer-editor"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Chapter text editor"
                aria-multiline="true"
                data-placeholder="Start writing your chapter here…"
                onInput={handleEditorInput}
                onPaste={() => setTimeout(handleEditorInput, 0)}
              />
            )}
            <div className="row between writer-editor-actions">
              <span className="fine">Formatting is shown to readers. Your existing chapter text is preserved.</span>
              <div className="row"><button type="button" className="btn ghost small" onClick={() => setFocusMode((v) => !v)}>{focusMode ? 'Exit focus mode' : 'Focus mode'}</button><button type="button" className="btn ghost small" onClick={() => setPreview(true)} disabled={preview}>Preview chapter</button></div>
            </div>
            {saveState && <span className="fine" role="status">{saveState}</span>}
          </div>
        )}

        {!isComic && <section className="writer-notes"><div className="row between"><div><b>Private book notes</b><p className="fine">Only stored in this browser. Use for plot ideas, character details or reminders.</p></div><button type="button" className="btn ghost small" onClick={() => setNotesOpen((v) => !v)}>{notesOpen ? 'Close notes' : 'Open notes'}</button></div>{notesOpen && <textarea className="in" rows="5" value={notes} onChange={(e) => { setNotes(e.target.value); try { localStorage.setItem('palixia-book-notes-' + book.id,e.target.value); } catch {} }} placeholder="Character names, plot threads, future scenes…" />}</section>}

        <div className="field writer-schedule"><label htmlFor="c-scheduled-at">Schedule publishing</label><input id="c-scheduled-at" className="in" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /><span className="fine">Uses your device's local time. Leave blank to save a draft or publish immediately.</span></div>
        <p className="msg-err" role="alert">{err}</p>
        {ok && <p className="msg-ok" role="status">{ok}</p>}
        <div className="row">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => save(published ? 'published' : scheduled ? 'scheduled' : 'draft')}>{busy ? 'Saving...' : published ? 'Save changes' : scheduled ? 'Save Schedule Changes' : 'Save Draft'}</button>
          {!published && <button type="button" className="btn" disabled={busy} onClick={() => save('published')}>Publish Chapter</button>}
          {!published && scheduledAt && <button type="button" className="btn ghost" disabled={busy} onClick={() => save('scheduled')}>Schedule Chapter</button>}
          {published && <button type="button" className="btn ghost" disabled={busy} onClick={() => save('draft')}>Unpublish</button>}
          {scheduled && <button type="button" className="btn ghost" disabled={busy} onClick={() => save('draft')}>Cancel schedule</button>}
          {chapter && <Link className="btn ghost" href={'/read/' + chapter.id}>Preview</Link>}
        </div>
      </div>
    </div>
  );
}

export default function ChapterEditorPage() {
  return <Guard roles={['author', 'admin']}><Editor /></Guard>;
}
