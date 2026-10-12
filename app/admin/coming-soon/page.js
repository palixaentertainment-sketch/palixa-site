'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';

const empty = { title: '', author_name: '', description: '', release_date: '', cover_url: '', linked_book_id: '', status: 'upcoming' };

function ComingSoonAdminPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [upcoming, published] = await Promise.all([
      supabase.from('coming_soon_books').select('*').order('created_at', { ascending: false }),
      supabase.from('book_cards').select('id,title,author_name').order('title').limit(300),
    ]);
    if (upcoming.error) setError('Could not load Coming Soon entries. Make sure the Coming Soon SQL setup has been run in Supabase.');
    else setItems(upcoming.data || []);
    setBooks(published.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      author_name: item.author_name || '',
      description: item.description || '',
      release_date: item.release_date || '',
      cover_url: item.cover_url || '',
      linked_book_id: item.linked_book_id || '',
      status: item.status || 'upcoming',
    });
    setCoverFile(null);
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setForm(empty);
    setEditingId('');
    setCoverFile(null);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!user) { setError('Please sign in again.'); return; }
    if (!form.title.trim()) { setError('Add a book title.'); return; }
    if (!form.author_name.trim()) { setError('Add the author name.'); return; }
    setBusy(true);
    try {
      let coverUrl = form.cover_url;
      if (coverFile) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(coverFile.type)) throw new Error('Use a JPG, PNG or WebP cover image.');
        if (coverFile.size > 2 * 1024 * 1024) throw new Error('Cover image must be 2 MB or smaller.');
        const safeName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = user.id + '/coming-soon/' + Date.now() + '-' + safeName;
        const upload = await supabase.storage.from('covers').upload(path, coverFile, { upsert: false, contentType: coverFile.type });
        if (upload.error) throw new Error('Cover upload failed. Please try a JPG, PNG or WebP image.');
        coverUrl = supabase.storage.from('covers').getPublicUrl(upload.data.path).data.publicUrl;
      }
      if (!coverUrl) throw new Error('Upload a cover image before saving.');
      const payload = {
        title: form.title.trim(),
        author_name: form.author_name.trim(),
        description: form.description.trim(),
        release_date: form.release_date || null,
        cover_url: coverUrl,
        linked_book_id: form.linked_book_id || null,
        status: form.status,
      };
      const result = editingId
        ? await supabase.from('coming_soon_books').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
        : await supabase.from('coming_soon_books').insert({ ...payload, created_by: user.id });
      if (result.error) throw new Error('Could not save this entry. Check the Coming Soon SQL setup in Supabase and try again.');
      setMessage(editingId ? 'Coming Soon entry updated.' : 'Book added to Coming Soon.');
      resetForm();
      await load();
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  async function changeStatus(item, status) {
    setError(''); setMessage(''); setBusy(true);
    const { error: updateError } = await supabase.from('coming_soon_books')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (updateError) setError('Could not update this entry. Please try again.');
    else {
      setMessage(status === 'released' ? 'Marked as released. It will no longer appear on the Coming Soon page.' : status === 'archived' ? 'Entry archived.' : 'Entry returned to Coming Soon.');
      await load();
    }
    setBusy(false);
  }

  async function remove(item) {
    if (!window.confirm('Delete "' + item.title + '" from Coming Soon? This cannot be undone.')) return;
    setBusy(true); setError(''); setMessage('');
    const { error: deleteError } = await supabase.from('coming_soon_books').delete().eq('id', item.id);
    if (deleteError) setError('Could not delete this entry.');
    else { setMessage('Entry deleted.'); if (editingId === item.id) resetForm(); await load(); }
    setBusy(false);
  }

  return (
    <div className="stack narrow">
      <Link className="linkbtn" href="/admin">← Admin dashboard</Link>
      <h1 className="h1">Coming Soon manager</h1>
      <p className="fine">Add upcoming books, upload covers, and manage release status. Only admins can create or edit entries.</p>
      {error && <p className="msg-err" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      <form className="panel stack" onSubmit={save} style={{ padding: '1rem', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
        <h2 className="h2">{editingId ? 'Edit upcoming book' : 'Add a book'}</h2>
        <div className="field"><label htmlFor="cs-title">Book title</label><input id="cs-title" className="in" maxLength={120} required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="cs-author">Author name</label><input id="cs-author" className="in" maxLength={120} required value={form.author_name} onChange={e => setForm({ ...form, author_name: e.target.value })} placeholder="Author or pen name" /></div>
        <div className="field"><label htmlFor="cs-description">Short teaser</label><textarea id="cs-description" className="in" maxLength={2000} rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="A short description to build anticipation" /></div>
        <div className="field"><label htmlFor="cs-cover">Cover image (JPG, PNG or WebP; max 2 MB)</label><input id="cs-cover" className="in" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setCoverFile(e.target.files?.[0] || null)} />{form.cover_url && !coverFile && <img src={form.cover_url} alt="Current cover" style={{ width: '130px', maxHeight: '200px', objectFit: 'cover', borderRadius: '.5rem' }} />}</div>
        <div className="field"><label htmlFor="cs-date">Expected release date (optional)</label><input id="cs-date" className="in" type="date" value={form.release_date} onChange={e => setForm({ ...form, release_date: e.target.value })} /></div>
        <div className="field"><label htmlFor="cs-linked">Published Palixia book (optional)</label><select id="cs-linked" className="in" value={form.linked_book_id} onChange={e => setForm({ ...form, linked_book_id: e.target.value })}><option value="">Not linked yet</option>{books.map(b => <option key={b.id} value={b.id}>{b.title} — {b.author_name}</option>)}</select><span className="fine">Link the real book here when it is published, then mark this entry as released.</span></div>
        {editingId && <div className="field"><label htmlFor="cs-status">Status</label><select id="cs-status" className="in" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="upcoming">Coming Soon</option><option value="released">Released</option><option value="archived">Archived</option></select></div>}
        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}><button className="btn" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add to Coming Soon'}</button>{editingId && <button type="button" className="btn ghost" onClick={resetForm} disabled={busy}>Cancel edit</button>}</div>
      </form>

      <section className="stack">
        <h2 className="h2">Your Coming Soon entries</h2>
        {loading ? <p className="muted">Loading entries…</p> : items.length === 0 ? <p className="fine">No entries yet. Add your first cover above.</p> : items.map(item => (
          <article key={item.id} className="panel stack" style={{ padding: '1rem', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: '1rem' }}>
              <img src={item.cover_url} alt={item.title + ' cover'} style={{ width: '105px', maxHeight: '160px', objectFit: 'cover', borderRadius: '.4rem' }} />
              <div style={{ flex: 1, minWidth: 0 }}><b>{item.title}</b><p className="fine">by {item.author_name}</p><p className="fine">Status: {item.status === 'upcoming' ? 'Coming Soon' : item.status}</p>{item.release_date && <p className="fine">Expected: {new Date(item.release_date + 'T12:00:00').toLocaleDateString()}</p>}</div>
            </div>
            <div className="row" style={{ gap: '.4rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost small" disabled={busy} onClick={() => startEdit(item)}>Edit</button>
              {item.status === 'upcoming' ? <button type="button" className="btn small" disabled={busy} onClick={() => changeStatus(item, 'released')}>Mark as released</button> : <button type="button" className="btn ghost small" disabled={busy} onClick={() => changeStatus(item, 'upcoming')}>Return to Coming Soon</button>}
              {item.status !== 'archived' && <button type="button" className="btn ghost small" disabled={busy} onClick={() => changeStatus(item, 'archived')}>Archive</button>}
              <button type="button" className="btn ghost small" disabled={busy} onClick={() => remove(item)}>Delete</button>
              {item.linked_book_id && <Link className="btn ghost small" href={'/book/' + item.linked_book_id}>View released book</Link>}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default function ComingSoonAdminPage() {
  return <Guard roles={['admin']}><ComingSoonAdminPanel /></Guard>;
}
