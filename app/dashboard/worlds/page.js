'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendly } from '@/lib/errors';
import Guard from '@/components/Guard';
import Empty from '@/components/Empty';

function WorldManager() {
  const { user } = useAuth();
  const [worlds, setWorlds] = useState([]);
  const [books, setBooks] = useState([]);
  const [selected, setSelected] = useState({});
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFailed(false);
    const [worldResult, bookResult, membershipResult] = await Promise.all([
      supabase.from('story_worlds').select('id,title,description,status,updated_at').eq('author_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('books').select('id,title,book_type,status,cover_url').eq('author_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('story_world_books').select('world_id,book_id'),
    ]);
    setLoading(false);
    if (worldResult.error || bookResult.error || membershipResult.error) {
      setFailed(true);
      return;
    }
    setWorlds(worldResult.data || []);
    setBooks(bookResult.data || []);
    const map = {};
    (worldResult.data || []).forEach((world) => {
      map[world.id] = (membershipResult.data || []).filter((row) => row.world_id === world.id).map((row) => row.book_id);
    });
    setSelected(map);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function createWorld(event) {
    event.preventDefault();
    setMessage('');
    const cleanTitle = title.trim();
    if (!cleanTitle) { setMessage('Give your Story World a title first.'); return; }
    setSaving(true);
    const { data, error } = await supabase.from('story_worlds')
      .insert({ author_id: user.id, title: cleanTitle, description: description.trim(), status: 'draft' })
      .select('id').single();
    setSaving(false);
    if (error) { setMessage(friendly(error, 'We could not create this Story World.')); return; }
    setTitle('');
    setDescription('');
    setMessage('Story World created. Add your books below, then publish it.');
    await load();
    if (data?.id) setSelected((current) => ({ ...current, [data.id]: [] }));
  }

  function toggleBook(worldId, bookId) {
    setSelected((current) => {
      const list = current[worldId] || [];
      return { ...current, [worldId]: list.includes(bookId) ? list.filter((id) => id !== bookId) : [...list, bookId] };
    });
  }

  async function saveBooks(world) {
    setMessage('');
    setSaving(true);
    const ids = selected[world.id] || [];
    const { error: deleteError } = await supabase.from('story_world_books').delete().eq('world_id', world.id);
    if (deleteError) {
      setSaving(false);
      setMessage(friendly(deleteError, 'We could not update the books in this world.'));
      return;
    }
    if (ids.length) {
      const rows = ids.map((bookId, index) => ({ world_id: world.id, book_id: bookId, position: index + 1 }));
      const { error } = await supabase.from('story_world_books').insert(rows);
      if (error) {
        setSaving(false);
        setMessage(friendly(error, 'We could not add those books. Try again.'));
        await load();
        return;
      }
    }
    setSaving(false);
    setMessage('Books in this Story World saved.');
    await load();
  }

  async function togglePublish(world) {
    setMessage('');
    const next = world.status === 'published' ? 'draft' : 'published';
    if (next === 'published' && !(selected[world.id] || []).length) {
      setMessage('Add at least one book to this Story World before publishing it.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('story_worlds').update({ status: next, updated_at: new Date().toISOString() }).eq('id', world.id);
    setSaving(false);
    if (error) { setMessage(friendly(error, 'We could not change this Story World status.')); return; }
    setMessage(next === 'published' ? 'Story World published.' : 'Story World moved back to draft.');
    await load();
  }

  async function deleteWorld(world) {
    if (!window.confirm('Delete "' + world.title + '"? This only removes the Story World collection. Your books and chapters will stay.')) return;
    setMessage('');
    const { error } = await supabase.from('story_worlds').delete().eq('id', world.id);
    if (error) { setMessage(friendly(error, 'We could not delete this Story World.')); return; }
    setMessage('Story World deleted. Your books are unchanged.');
    await load();
  }

  return (
    <div className="stack">
      <div className="stack">
        <Link className="linkbtn" href="/dashboard">← Author dashboard</Link>
        <span className="mono">AUTHOR STUDIO</span>
        <h1 className="h1">Story Worlds</h1>
        <p className="muted">Bring related books and comics together. Create a series, connect its stories, and give readers one place to explore the whole universe.</p>
      </div>

      <form className="world-form stack" onSubmit={createWorld}>
        <h2 className="h2">Create a Story World</h2>
        <div className="field">
          <label htmlFor="world-title">World or series name</label>
          <input className="in" id="world-title" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Hollow City universe" />
        </div>
        <div className="field">
          <label htmlFor="world-description">Description</label>
          <textarea className="in" id="world-description" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What connects these stories? Give readers a reason to step inside." />
        </div>
        <div className="row">
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Story World'}</button>
          <span className="fine">New worlds start as drafts.</span>
        </div>
      </form>

      {message && <p className="notice" role="status">{message}</p>}
      {failed && <div className="notice"><b>Story Worlds database setup is needed.</b><p>Run the additive file <code>supabase/story_worlds.sql</code> in Supabase → SQL Editor, then reload this page. Your existing books and chapters will not be changed.</p></div>}
      {loading && <p className="muted">Loading your Story Worlds...</p>}
      {!loading && !failed && worlds.length === 0 && <Empty title="Your first Story World starts here." text="Create a world above, then choose which books and comics belong in it." />}
      {!loading && !failed && worlds.map((world) => {
        const chosen = selected[world.id] || [];
        return (
          <section className="world-manage-card stack" key={world.id}>
            <div className="row between">
              <div className="stack" style={{ gap: '.3rem' }}>
                <h2 className="h2">{world.title}</h2>
                <span className={'badge ' + (world.status === 'published' ? 'live' : 'draft')}>{world.status === 'published' ? 'Published' : 'Draft'}</span>
              </div>
              {world.status === 'published' && <Link className="btn ghost small" href={'/worlds/' + world.id}>View world</Link>}
            </div>
            {world.description && <p className="muted">{world.description}</p>}
            <div className="stack" style={{ gap: '.65rem' }}>
              <h3>Choose books and comics</h3>
              {books.length === 0 ? <p className="fine">Create a book or comic first, then return here to connect it.</p> : books.map((book) => (
                <label className="world-book-option" key={book.id}>
                  <input type="checkbox" checked={chosen.includes(book.id)} onChange={() => toggleBook(world.id, book.id)} />
                  <span><b>{book.title}</b><small>{book.book_type === 'comic' ? 'Comic' : 'Book'} · {book.status}</small></span>
                </label>
              ))}
              <p className="fine">Selected: {chosen.length} {chosen.length === 1 ? 'story' : 'stories'}. Draft books can be organised here, but readers only see published books.</p>
            </div>
            <div className="row">
              <button type="button" className="btn" disabled={saving} onClick={() => saveBooks(world)}>Save books</button>
              <button type="button" className="btn ghost" disabled={saving} onClick={() => togglePublish(world)}>{world.status === 'published' ? 'Unpublish world' : 'Publish world'}</button>
              <button type="button" className="linkbtn" disabled={saving} onClick={() => deleteWorld(world)}>Delete world</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function StoryWorldsManagerPage() {
  return <Guard roles={['author', 'admin']}><WorldManager /></Guard>;
}
