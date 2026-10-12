'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';
import Avatar from '@/components/Avatar';

export default function GroupsPage() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [books, setBooks] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState('community');
  const [bookId, setBookId] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadGroups = useCallback(async () => {
    if (!configured || !user) return;
    const { data: publicGroups, error: groupError } = await supabase
      .from('reading_groups')
      .select('id,name,description,group_type,book_id,visibility,avatar_url,creator_id,created_at,profiles!reading_groups_creator_id_fkey(name,username,avatar_url),reading_group_members(user_id)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(100);
    if (groupError) { setError('Groups could not load: ' + groupError.message); return; }
    const { data: memberships } = await supabase.from('reading_group_members').select('group_id').eq('user_id', user.id);
    const memberIds = new Set((memberships || []).map((m) => m.group_id));
    setGroups((publicGroups || []).map((g) => ({ ...g, joined: memberIds.has(g.id) })));
    const { data: privateGroups } = await supabase
      .from('reading_groups')
      .select('id,name,description,group_type,book_id,visibility,avatar_url,creator_id,created_at,profiles!reading_groups_creator_id_fkey(name,username,avatar_url)')
      .eq('visibility', 'private').order('created_at', { ascending: false });
    const publicMine = (publicGroups || []).filter((g) => memberIds.has(g.id));
    setMyGroups([...publicMine, ...(privateGroups || []).filter((g) => memberIds.has(g.id))]);
  }, [user]);

  const loadMessages = useCallback(async (group) => {
    if (!group || !user) return;
    const { data, error: messageError } = await supabase
      .from('reading_group_messages')
      .select('id,group_id,sender_id,body,created_at,profiles!reading_group_messages_sender_id_fkey(name,username,avatar_url)')
      .eq('group_id', group.id).order('created_at', { ascending: true }).limit(200);
    if (messageError) { setError('Chat could not load: ' + messageError.message); return; }
    setMessages(data || []);
  }, [user]);

  useEffect(() => {
    if (!configured || !user) return;
    loadGroups();
    supabase.from('books').select('id,title').eq('author_id', user.id).order('title').limit(200)
      .then(({ data }) => setBooks(data || []));
  }, [user, loadGroups]);

  useEffect(() => {
    if (!activeGroup) return;
    loadMessages(activeGroup);
    const timer = setInterval(() => loadMessages(activeGroup), 5000);
    return () => clearInterval(timer);
  }, [activeGroup, loadMessages]);

  async function createGroup(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (!name.trim()) { setError('Add a group name first.'); return; }
    if (groupType === 'book' && !bookId) { setError('Choose one of your books for this book group.'); return; }
    setBusy(true);
    const { error: createError } = await supabase.from('reading_groups').insert({
      creator_id: user.id, name: name.trim(), description: description.trim(),
      group_type: groupType, book_id: groupType === 'book' ? bookId : null, visibility: visibility,
    });
    setBusy(false);
    if (createError) { setError('Could not create group: ' + createError.message); return; }
    setName(''); setDescription(''); setBookId(''); setGroupType('community'); setVisibility('public'); setShowCreate(false);
    setNotice('Your group has been created.');
    await loadGroups();
  }

  async function joinGroup(group) {
    setError(''); setNotice('');
    const { error: joinError } = await supabase.from('reading_group_members').insert({ group_id: group.id, user_id: user.id });
    if (joinError && !String(joinError.message).toLowerCase().includes('duplicate')) { setError('Could not join group: ' + joinError.message); return; }
    await loadGroups();
    setActiveGroup(group);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !activeGroup) return;
    const body = draft.trim(); setDraft(''); setError('');
    const { error: sendError } = await supabase.from('reading_group_messages').insert({
      group_id: activeGroup.id, sender_id: user.id, body,
    });
    if (sendError) { setDraft(body); setError('Message not sent: ' + sendError.message); return; }
    await loadMessages(activeGroup);
  }

  const joined = myGroups.some((g) => g.id === activeGroup?.id);
  const canCreateBookGroup = profile && ['author', 'admin'].includes(profile.role);

  return <Guard><main className="wrap page">
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <div><p className="mono">PALIXIA COMMUNITY</p><h1 className="h1">Reading groups</h1><p className="muted" style={{ marginTop: 8 }}>Find your people, talk about books, and build a reading room together.</p></div>
      <button className="btn" type="button" onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Cancel' : '+ Create group'}</button>
    </div>

    {!configured && <div className="notice">Messaging is not configured in this deployment yet.</div>}
    {notice && <div className="notice">{notice}</div>}
    {error && <div className="notice" role="alert">{error}</div>}

    {showCreate && <section className="card stack" style={{ padding: 16 }}>
      <h2 className="h2">Create a group</h2>
      <form className="stack" onSubmit={createGroup}>
        <label className="stack">Group name<input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="e.g. Fantasy Readers" /></label>
        <label className="stack">Description<textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="What is this group about?" /></label>
        <label className="stack">Group type<select className="input" value={groupType} onChange={(e) => setGroupType(e.target.value)}><option value="community">Community group</option>{canCreateBookGroup && <option value="book">Group for one of my books</option>}</select></label>
        {groupType === 'book' && <label className="stack">Choose your book<select className="input" value={bookId} onChange={(e) => setBookId(e.target.value)} required><option value="">Select a book</option>{books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label>}
        <label className="stack">Who can see it?<select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="public">Public — anyone can join</option><option value="private">Private — invitation only (invites coming soon)</option></select></label>
        <p className="fine">You’ll automatically become the group owner. Private group invitations are not available yet, so create a public group if you want people to join now.</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button>
      </form>
    </section>}

    <div className="stack" style={{ gap: 18 }}>
      {activeGroup ? <section className="card stack" style={{ padding: 16, gap: 12 }}>
        <div className="row between"><div><button className="muted" type="button" onClick={() => setActiveGroup(null)}>← All groups</button><h2 className="h2" style={{ marginTop: 8 }}>{activeGroup.name}</h2><p className="fine">{activeGroup.group_type === 'book' ? 'Book group' : 'Community group'} · {activeGroup.visibility}</p></div><button className="btn ghost small" type="button" onClick={() => loadMessages(activeGroup)}>Refresh</button></div>
        {activeGroup.description && <p className="muted">{activeGroup.description}</p>}
        <div style={{ background: '#f1ebfc', borderRadius: 10, padding: 12, minHeight: 240, maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && <p className="muted" style={{ textAlign: 'center', margin: 'auto' }}>No messages yet. Start the conversation 💜</p>}
          {messages.map((m) => <div key={m.id} style={{ alignSelf: m.sender_id === user.id ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
            {m.sender_id !== user.id && <p className="fine" style={{ margin: '0 0 3px 4px' }}>{m.profiles?.name || m.profiles?.username || 'Reader'}</p>}
            <div style={{ background: m.sender_id === user.id ? '#2e1065' : '#fff', color: m.sender_id === user.id ? '#fff' : '#1b1033', border: '1px solid #e7defa', borderRadius: 14, padding: '9px 12px', overflowWrap: 'anywhere' }}>{m.body}</div>
            <p className="fine" style={{ textAlign: m.sender_id === user.id ? 'right' : 'left', fontSize: 11 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>)}
        </div>
        {joined ? <form onSubmit={sendMessage} className="row" style={{ flexWrap: 'nowrap' }}><input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000} placeholder="Write a message…" aria-label="Write a message" /><button className="btn" type="submit" disabled={!draft.trim()}>Send</button></form> : <button className="btn" type="button" onClick={() => joinGroup(activeGroup)}>Join this group to chat</button>}
      </section> : <>
        <section className="stack">
          <h2 className="h2">Your groups</h2>
          {myGroups.length === 0 && <p className="muted">You haven’t joined a group yet. Explore the public groups below.</p>}
          {myGroups.map((g) => <GroupCard key={g.id} group={g} onOpen={() => setActiveGroup(g)} />)}
        </section>
        <section className="stack">
          <h2 className="h2">Discover groups</h2>
          {groups.length === 0 && <p className="muted">No public groups yet. Be the first to create one.</p>}
          {groups.map((g) => <GroupCard key={g.id} group={g} onOpen={() => g.joined ? setActiveGroup(g) : joinGroup(g)} action={g.joined ? 'Open chat' : 'Join group'} />)}
        </section>
      </>}
    </div>
    <p className="fine">Group chats refresh automatically every few seconds. Be respectful and never share private information you don’t want others to see.</p>
  </main></Guard>;
}

function GroupCard({ group, onOpen, action }) {
  return <article className="card row between" style={{ padding: 14, alignItems: 'center' }}>
    <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0, alignItems: 'flex-start' }}>
      <Avatar src={group.avatar_url || group.profiles?.avatar_url} name={group.name} size="2.8rem" />
      <div style={{ minWidth: 0 }}><h3 style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{group.name}</h3><p className="fine">{group.group_type === 'book' ? 'Book group' : 'Community'} · {group.visibility}</p>{group.description && <p className="muted" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{group.description}</p>}<p className="fine" style={{ marginTop: 4 }}>Created by {group.profiles?.name || group.profiles?.username || 'Palixia reader'}</p></div>
    </div>
    {action && <button className="btn small" type="button" onClick={onOpen}>{action}</button>}
  </article>;
}
