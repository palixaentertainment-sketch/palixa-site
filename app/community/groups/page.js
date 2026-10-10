'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Avatar from '@/components/Avatar';

const GENRES = ['General', 'Fantasy', 'Romance', 'Thriller', 'Mystery', 'Sci-fi', 'Poetry', 'Comics & Manga', 'Writing', 'Young Adult', 'Other'];

function timeLabel(value) {
  const date = new Date(value);
  const ms = Math.max(0, Date.now() - date.getTime());
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
  if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function ReaderGroupsPage() {
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [posts, setPosts] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('General');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    if (!configured) { setError('The database is not configured for this deployment.'); setLoading(false); return; }
    setLoading(true);
    const [{ data: groupData, error: groupError }, { data: memberData }] = await Promise.all([
      supabase.from('community_groups')
        .select('id,owner_id,name,description,genre,created_at,profiles!community_groups_owner_id_fkey(name,username)')
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('community_group_members').select('group_id,user_id,role'),
    ]);
    if (groupError) {
      console.error('Reader groups could not load:', groupError);
      setError('Reader Groups need their database setup before they can be used.');
      setGroups([]);
    } else {
      setError('');
      setGroups(groupData || []);
      setMemberships(memberData || []);
      if (groupData?.length && !selectedId) setSelectedId(groupData[0].id);
      if (selectedId && !(groupData || []).some((g) => g.id === selectedId)) setSelectedId(groupData?.[0]?.id || '');
    }
    setLoading(false);
  }, [selectedId]);

  const loadPosts = useCallback(async (groupId) => {
    if (!groupId || !configured) { setPosts([]); return; }
    const { data, error: postError } = await supabase.from('community_group_posts')
      .select('id,group_id,user_id,body,created_at,profiles!community_group_posts_user_id_fkey(name,username,avatar_url)')
      .eq('group_id', groupId).order('created_at', { ascending: false }).limit(50);
    if (postError) {
      console.error('Group discussion could not load:', postError);
      setPosts([]);
      return;
    }
    setPosts(data || []);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { loadPosts(selectedId); }, [selectedId, loadPosts]);

  const selected = groups.find((group) => group.id === selectedId);
  const myMembership = selected && memberships.some((m) => m.group_id === selected.id && user && m.user_id === user.id);
  const memberCount = (groupId) => memberships.filter((m) => m.group_id === groupId).length;
  const filteredGroups = groups.filter((group) => {
    const term = search.trim().toLowerCase();
    return !term || [group.name, group.description, group.genre].some((value) => (value || '').toLowerCase().includes(term));
  });

  async function createGroup(event) {
    event.preventDefault();
    if (!user) { setNotice('Log in to create a reader group.'); return; }
    if (name.trim().length < 3 || !description.trim()) { setNotice('Add a group name (at least 3 characters) and a short description.'); return; }
    setBusy(true); setNotice(''); setError('');
    const { data, error: createError } = await supabase.from('community_groups')
      .insert({ owner_id: user.id, name: name.trim(), description: description.trim(), genre })
      .select('id').single();
    if (createError) {
      console.error('Reader group could not be created:', createError);
      setNotice('The group could not be created. Please try again.');
      setBusy(false);
      return;
    }
    const { error: joinError } = await supabase.from('community_group_members')
      .insert({ group_id: data.id, user_id: user.id, role: 'owner' });
    setName(''); setDescription(''); setGenre('General'); setBusy(false);
    setNotice(joinError ? 'Group created. Refresh and join it to participate.' : 'Your reader group is ready!');
    await loadGroups();
    setSelectedId(data.id);
  }

  async function toggleMembership(group) {
    if (!user) { setNotice('Log in to join a reader group.'); return; }
    setBusy(true); setNotice('');
    const joined = memberships.some((m) => m.group_id === group.id && m.user_id === user.id);
    const result = joined
      ? await supabase.from('community_group_members').delete().eq('group_id', group.id).eq('user_id', user.id)
      : await supabase.from('community_group_members').insert({ group_id: group.id, user_id: user.id, role: 'member' });
    setBusy(false);
    if (result.error) { setNotice('That action could not be saved. Please try again.'); return; }
    setNotice(joined ? 'You left the group.' : 'You joined the group. Welcome!');
    await loadGroups();
  }

  async function publishGroupPost(event) {
    event.preventDefault();
    if (!user) { setNotice('Log in to join the discussion.'); return; }
    if (!selected || !myMembership) { setNotice('Join this group before posting.'); return; }
    if (!draft.trim()) { setNotice('Write a message before posting.'); return; }
    setBusy(true); setNotice('');
    const { error: postError } = await supabase.from('community_group_posts')
      .insert({ group_id: selected.id, user_id: user.id, body: draft.trim() });
    setBusy(false);
    if (postError) { setNotice('Your message could not be published. Please try again.'); return; }
    setDraft('');
    setNotice('Your message is live.');
    await loadPosts(selected.id);
  }

  async function deleteGroupPost(postId) {
    if (!window.confirm('Delete this group message?')) return;
    const { error: deleteError } = await supabase.from('community_group_posts').delete().eq('id', postId);
    if (deleteError) { setNotice('Could not delete that message.'); return; }
    setNotice('Message deleted.');
    await loadPosts(selectedId);
  }

  return (
    <div className="community stack">
      <section className="community-hero">
        <p className="mono">FIND YOUR PEOPLE</p>
        <h1 className="h1">Reader Groups</h1>
        <p>Find readers who love the same genres, talk about your favourite stories, and build a reading circle.</p>
        <div className="community-group-nav">
          <Link className="btn ghost small" href="/community">← Community feed</Link>
          <span className="fine">{groups.length} {groups.length === 1 ? 'group' : 'groups'} to explore</span>
        </div>
      </section>

      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="notice" role="alert">{error}</p>}

      <section className="community-compose">
        <h2 className="h2">Create a reader group</h2>
        {user ? (
          <form className="stack" onSubmit={createGroup}>
            <label className="field"><span>Group name</span><input className="in" maxLength={60} minLength={3} required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fantasy Book Lovers" /></label>
            <label className="field"><span>What is this group about?</span><textarea className="in" maxLength={500} rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell readers what you want to discuss together." /></label>
            <label className="field"><span>Genre or interest</span><select className="in" value={genre} onChange={(e) => setGenre(e.target.value)}>{GENRES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button>
          </form>
        ) : (
          <p className="muted"><Link className="linkbtn" href="/login?next=%2Fcommunity%2Fgroups">Log in</Link> to create or join a reader group.</p>
        )}
      </section>

      <section className="stack">
        <div className="community-feed-head"><h2 className="h2">Explore groups</h2><span className="fine">{filteredGroups.length} found</span></div>
        <input className="in" aria-label="Search reader groups" placeholder="Search by name, genre, or interest…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {loading && <p className="muted">Loading reader groups…</p>}
        {!loading && !error && filteredGroups.length === 0 && <div className="empty"><div><b>No groups found yet.</b><p>Create the first group and invite readers to join.</p></div></div>}
        <div className="community-group-grid">
          {filteredGroups.map((group) => {
            const joined = memberships.some((m) => m.group_id === group.id && user && m.user_id === user.id);
            return (
              <article className={'community-group-card' + (selectedId === group.id ? ' selected' : '')} key={group.id}>
                <button className="community-group-open" type="button" onClick={() => setSelectedId(group.id)}>
                  <span className="community-group-genre">{group.genre}</span>
                  <h3>{group.name}</h3>
                  <p>{group.description}</p>
                  <span className="fine">{memberCount(group.id)} {memberCount(group.id) === 1 ? 'member' : 'members'} · Started {timeLabel(group.created_at)}</span>
                </button>
                <div className="community-group-card-actions">
                  <button className="btn small" type="button" disabled={busy || group.owner_id === user?.id} onClick={() => toggleMembership(group)}>{group.owner_id === user?.id ? 'Group owner' : joined ? 'Leave group' : 'Join group'}</button>
                  {group.profiles?.username && <span className="fine">by @{group.profiles.username}</span>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {selected && (
        <section className="stack community-group-discussion">
          <div className="community-feed-head"><div><p className="mono">GROUP DISCUSSION</p><h2 className="h2">{selected.name}</h2><p className="muted">{selected.description}</p></div><span className="community-group-genre">{selected.genre}</span></div>
          {myMembership ? (
            <form className="community-group-post-form" onSubmit={publishGroupPost}>
              <textarea className="in" rows={3} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Start a conversation with this group…" />
              <button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Post to group'}</button>
            </form>
          ) : <p className="fine">Join this group to take part in the discussion.</p>}
          {posts.length === 0 && <div className="empty"><div><b>No discussion yet.</b><p>Be the first member to start one.</p></div></div>}
          {posts.map((post) => (
            <article className="community-post" key={post.id}>
              <div className="community-post-head">
                <Avatar src={post.profiles?.avatar_url} name={post.profiles?.name || 'Reader'} size="2.5rem" />
                <div className="community-post-by"><b>{post.profiles?.name || 'Reader'}</b><span className="fine">{post.profiles?.username ? '@' + post.profiles.username + ' · ' : ''}{timeLabel(post.created_at)}</span></div>
                {user?.id === post.user_id && <button className="linkbtn" type="button" onClick={() => deleteGroupPost(post.id)}>Delete</button>}
              </div>
              <p className="community-post-body">{post.body}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
