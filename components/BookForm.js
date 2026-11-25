'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { friendly } from '@/lib/errors';
import { checkImage, uploadImage } from '@/lib/upload';
import Cover from '@/components/Cover';

const QUICK_TAGS = ['romance', 'fantasy', 'mystery', 'werewolf', 'billionaire', 'campus', 'revenge', 'thriller', 'supernatural', 'family', 'friendship', 'dark romance'];

export default function BookForm({ userId, book, locked, onSaved }) {
  const [genres, setGenres] = useState([]);
  const [title, setTitle] = useState(book ? book.title : '');
  const [description, setDescription] = useState(book ? book.description || '' : '');
  const [genreId, setGenreId] = useState(book ? book.genre_id || '' : '');
  const [tags, setTags] = useState(book ? (book.tags || []).filter((t) => t !== 'sample').join(', ') : '');
  const [type, setType] = useState(book ? book.book_type : 'text');
  const [storyStatus, setStoryStatus] = useState(book ? (book.story_status || 'ongoing') : 'ongoing');
  const [language, setLanguage] = useState(book ? book.language || 'English' : 'English');
  const [targetAudience, setTargetAudience] = useState(book ? book.target_audience || '' : '');
  const [bookLength, setBookLength] = useState(book ? book.book_length || '' : '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('genres').select('*').order('sort').then(({ data }) => setGenres((data || []).filter((genre) => genre.slug !== 'comics')));
  }, []);

  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e) {
    const f = e.target.files[0] || null;
    setErr('');
    if (f) {
      const problem = checkImage(f, 8);
      if (problem) { setErr(problem); e.target.value = ''; setFile(null); return; }
    }
    setFile(f);
  }

  function addTag(tag) {
    const current = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (!current.some((t) => t.toLowerCase() === tag.toLowerCase()) && current.length < 8) {
      setTags([...current, tag].join(', '));
    }
  }

  async function save(status) {
    setErr(''); setOk('');
    if (!title.trim()) { setErr('Add a book title.'); return; }
    if (status === 'published' && !description.trim()) { setErr('Add a description before publishing.'); return; }
    setBusy(true);
    try {
      let cover_url = book ? book.cover_url : null;
      if (file) cover_url = await uploadImage('covers', userId, file);
      const tagList = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8);
      const fields = {
        title: title.trim(),
        description: description.trim() || null,
        genre_id: genreId || null,
        tags: tagList,
        cover_url,
        book_type: type,
        story_status: storyStatus,
        language: language || 'English',
        target_audience: targetAudience || null,
        book_length: bookLength || null,
      };
      if (book) {
        const patch = { ...fields, updated_at: new Date().toISOString() };
        if (status) patch.status = status;
        const { error } = await supabase.from('books').update(patch).eq('id', book.id);
        if (error) throw error;
        setFile(null);
        setOk(status === 'published' ? 'Published.' : 'Saved.');
        if (onSaved) onSaved();
      } else {
        const { data, error } = await supabase.from('books')
          .insert({ ...fields, author_id: userId, status: status || 'draft' })
          .select('id').single();
        if (error) throw error;
        if (onSaved) onSaved(data.id);
      }
    } catch (e) {
      setErr(friendly(e, 'We could not save your book. Please try again.'));
    }
    setBusy(false);
  }

  const shownCover = { title: title || 'Your title', book_type: type, cover_url: preview || (book ? book.cover_url : null), author_name: '' };
  const selectedTags = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); save(null); }} noValidate>
      <div className="field">
        <label htmlFor="b-title">Book title</label>
        <input id="b-title" className="in" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </div>
      <div className="field">
        <span className="lab" id="lab-type">Format</span>
        <div className="seg" role="radiogroup" aria-labelledby="lab-type">
          <input type="radio" name="type" id="t-text" checked={type === 'text'} disabled={locked} onChange={() => setType('text')} /><label htmlFor="t-text">Text book</label>
          <input type="radio" name="type" id="t-comic" checked={type === 'comic'} disabled={locked} onChange={() => setType('comic')} /><label htmlFor="t-comic">Comic</label>
        </div>
        <span className="fine">{locked ? 'The format cannot change once chapters exist.' : type === 'comic' ? 'Comics are chapters made of page images, read top to bottom.' : 'Text books are chapters of written text.'}</span>
      </div>
      <div className="field">
        <label htmlFor="b-story-status">Story status</label>
        <select id="b-story-status" className="in" value={storyStatus} onChange={(e) => setStoryStatus(e.target.value)}>
          <option value="ongoing">Ongoing — new chapters coming</option>
          <option value="completed">Completed — story has ended</option>
          <option value="hiatus">On hiatus — updates paused</option>
        </select>
        <span className="fine">You can change this later from the book editor.</span>
      </div>
      <div className="field">
        <label htmlFor="b-desc">Synopsis</label>
        <textarea id="b-desc" className="in" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="What is this story about? Give readers a reason to open the first chapter." />
        <span className="fine">{description.length}/2,000 characters</span>
      </div>
      <div className="field">
        <label htmlFor="b-genre">Genre</label>
        <select id="b-genre" className="in" value={genreId} onChange={(e) => setGenreId(e.target.value)}>
          <option value="">Choose a genre</option>
          {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="b-language">Language</label>
        <select id="b-language" className="in" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {['English', 'French', 'Portuguese', 'Spanish', 'Arabic', 'Hausa', 'Igbo', 'Yoruba', 'Other'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="b-audience">Target audience <span className="fine">(optional)</span></label>
        <select id="b-audience" className="in" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}>
          <option value="">Not specified</option>
          <option value="all">All readers</option>
          <option value="male">Primarily male readers</option>
          <option value="female">Primarily female readers</option>
        </select>
        <span className="fine">This helps readers understand who a story is written for. It does not restrict who can read it.</span>
      </div>
      <div className="field">
        <label htmlFor="b-length">Book length <span className="fine">(optional)</span></label>
        <select id="b-length" className="in" value={bookLength} onChange={(e) => setBookLength(e.target.value)}>
          <option value="">Not specified</option>
          <option value="short_story">Short story</option>
          <option value="novella">Novella</option>
          <option value="novel">Novel</option>
          <option value="long_novel">Long novel</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="b-tags">Tags <span className="fine">(optional, up to 8)</span></label>
        <input id="b-tags" className="in" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="campus, secrets, friendship" />
        <span className="fine">Add specific themes, tropes or subjects readers might search for. Separate tags with commas.</span>
        <div className="row" style={{ gap: '.45rem', flexWrap: 'wrap', marginTop: '.55rem' }}>
          {QUICK_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return <button key={tag} type="button" className={'btn small ' + (active ? '' : 'ghost')} disabled={active || selectedTags.length >= 8} onClick={() => addTag(tag)}>{active ? '✓ ' : '+ '}{tag}</button>;
          })}
        </div>
      </div>
      <div className="field">
        <label htmlFor="b-cover">Cover</label>
        <div className="coverpick">
          <Cover b={shownCover} />
          <div className="stack" style={{ gap: '0.5rem' }}>
            <input id="b-cover" className="in" type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
            <span className="fine">Best at a 2:3 ratio, for example 800 by 1200 pixels. JPG, PNG or WebP, up to 8 MB. Palixia automatically compresses the cover for faster loading. Without a cover, Palixia makes a purple one from your title.</span>
          </div>
        </div>
      </div>
      <p className="msg-err" role="alert">{err}</p>
      {ok && <p className="msg-ok" role="status">{ok}</p>}
      <div className="row">
        <button className="btn ghost" type="button" disabled={busy} onClick={() => save(book ? (book.status === 'published' ? 'published' : 'draft') : 'draft')}>{busy ? 'Saving...' : 'Save Draft'}</button>
        {(!book || book.status !== 'published') && (
          <button className="btn" type="button" disabled={busy} onClick={() => save('published')}>Publish</button>
        )}
      </div>
    </form>
  );
}
