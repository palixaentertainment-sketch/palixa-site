'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Avatar from '@/components/Avatar';

const CATEGORIES = [
  ['all', 'All posts'],
  ['reading-room', 'Reading Room'],
  ['writers-corner', "Writers’ Corner"],
  ['share-your-work', 'Share Your Work'],
  ['comics-art', 'Comics & Art'],
  ['general', 'General Lounge'],
];
const LABELS = Object.fromEntries(CATEGORIES.filter(([id]) => id !== 'all'));

function timeLabel(value) {
  const ms = Math.max(0, Date.now() - new Date(value).getTime());
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + 'm ago';
  if (ms < 86_400_000) return Math.floor(ms / 3_600_000) + 'h ago';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function CommunityPage() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState(null);
  const [category, setCategory] = useState('all');
  const [postCategory, setPostCategory] = useState('general');
  const [body, setBody] = useState('');
  const [bookId, setBookId] = useState('');
  const [books, setBooks] = useState([]);
  const [comments, setComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState('');

  const loadPosts = useCallback(async () => {
    if (!configured) { setPosts([]); setLoadError(true); setLoadErrorMessage('Supabase is not configured in this deployment.'); return; }
    const { data, error: queryError } = await supabase
      .from('community_posts')
      .select('id,user_id,category,body,book_id,created_at,profiles!community_posts_user_id_fkey(name,username,avatar_url),books(id,title,book_type),community_likes(user_id),community_comments(id)')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(60);
    if (queryError) {
      console.error('Community feed could not load:', queryError);
      setPosts([]);
      setLoadError(true);
      setLoadErrorMessage(queryError.message || 'Unknown database error');
      return;
    }
    setLoadError(false);
    setLoadErrorMessage('');
    setPosts((data || []).map((post) => ({
      ...post,
      likeCount: (post.community_likes || []).length,
      commentCount: (post.community_comments || []).length,
      liked: Boolean(user && (post.community_likes || []).some((like) => like.user_id === user.id)),
    })));
  }, [user]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (!configured) return;
    supabase.from('book_cards').select('id,title,book_type').order('title').limit(200)
      .then(({ data }) => setBooks(data || []));
  }, []);

  async function createPost(e) {
    e.preventDefault();
    if (!user) { setError('Log in to post in the Community.'); return; }
    if (!body.trim()) { setError('Write something before posting.'); return; }
    setBusy(true); setError(''); setNotice('');
    const { error: insertError } = await supabase.from('community_posts').insert({
      user_id: user.id, category: postCategory,
      body: body.trim(), book_id: bookId || null,
    });
    setBusy(false);
    if (insertError) {
      setError('Your post could not be published. Please check the Community setup and try again.');
      return;
    }
    setBody(''); setBookId(''); setPostCategory('general');
    setNotice('Your post is live.');
    await loadPosts();
  }

  async function toggleLike(post) {
    if (!user) { setNotice('Log in to like posts.'); return; }
    setNotice('');
    const result = post.liked
      ? await supabase.from('community_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      : await supabase.from('community_likes').insert({ post_id: post.id, user_id: user.id });
    if (result.error) { setNotice('Could not save your like. Please try again.'); return; }
    await loadPosts();
  }

  async function loadComments(postId, force = false) {
    setOpenComments((old) => ({ ...old, [postId]: true }));
    if (comments[postId] && !force) return;
    const { data, error: commentError } = await supabase.from('community_comments')
      .select('id,post_id,user_id,parent_id,body,created_at,profiles!community_comments_user_id_fkey(name,username)')
      .eq('post_id', postId).eq('status', 'visible').order('created_at').limit(100);
    if (commentError) { setNotice('Comments could not load right now.'); return; }
    setComments((old) => ({ ...old, [postId]: data || [] }));
  }

  async function addComment(postId, parentId = null) {
    if (!user) { setNotice('Log in to reply.'); return; }
    const key = postId + (parentId || '');
    const text = (commentDrafts[key] || '').trim();
    if (!text) return;
    const { error: commentError } = await supabase.from('community_comments').insert({
      post_id: postId, user_id: user.id, parent_id: parentId, body: text,
    });
    if (commentError) { setNotice('Your reply could not be posted. Please try again.'); return; }
    setCommentDrafts((old) => ({ ...old, [key]: '' }));
    setComments((old) => ({ ...old, [postId]: null }));
    await loadComments(postId, true);
    await loadPosts();
  }

  async function deletePost(postId) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    const { error: deleteError } = await supabase.from('community_posts').delete().eq('id', postId);
    if (deleteError) { setNotice('Could not delete this post.'); return; }
    setNotice('Post deleted.');
    await loadPosts();
  }

  async function reportPost(postId) {
    if (!user) { setNotice('Log in to report a post.'); return; }
    const reason = window.prompt('Briefly tell us why you are reporting this post:');
    if (reason === null) return;
    if (reason.trim().length < 3) { setNotice('Please enter a short reason for the report.'); return; }
    const { error: reportError } = await supabase.from('community_reports').insert({
      post_id: postId, reporter_id: user.id, reason: reason.trim().slice(0, 500),
    });
    setNotice(reportError ? 'You may already have reported this post, or the report could not be saved.' : 'Thank you. Your report has been submitted.');
  }

  const visiblePosts = (posts || []).filter((post) => category === 'all' || post.category === category);

  return (
    <div className="community stack">
      <section className="community-hero">
        <p className="mono">READ · PUBLISH · CONNECT</p>
        <h1 className="h1">The Palixia Community</h1>
        <p>Talk about the stories you love, meet other writers, and share what you’re creating.</p>
      </section>

      {notice && <p className="notice" role="status">{notice}</p>}
      {loadError && (
        <div className="notice">
          <b>Community setup is not finished yet.</b>
          <p>The Community feed could not load. Your tables exist, so we’re checking the exact database error.</p><p className="fine">Technical detail: {loadErrorMessage || 'No details returned.'}</p>
        </div>
      )}

      <section className="community-compose">
        <h2 className="h2">Start a conversation</h2>
        {user ? (
          <form className="stack" onSubmit={createPost}>
            <div className="community-compose-head">
              <Avatar src={profile && profile.avatar_url} name={profile ? profile.name : 'You'} size="2.5rem" />
              <span><b>{profile ? profile.name : 'Your account'}</b><span className="fine">Share something with the community</span></span>
            </div>
            <label className="sr-only" htmlFor="community-body">Your post</label>
            <textarea id="community-body" className="in community-textarea" maxLength={2000} rows={4}
              placeholder="What are you reading, writing, or thinking about?" value={body}
              onChange={(e) => setBody(e.target.value)} />
            <div className="community-compose-controls">
              <label className="field community-field"><span className="sr-only">Choose a category</span>
                <select className="in" value={postCategory} onChange={(e) => setPostCategory(e.target.value)} aria-label="Post category">
                  {CATEGORIES.filter(([id]) => id !== 'all').map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <label className="field community-field"><span className="sr-only">Attach a book or comic</span>
                <select className="in" value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Attach a published book or comic">
                  <option value="">No book or comic attached</option>
                  {books.map((book) => <option key={book.id} value={book.id}>{book.title}{book.book_type === 'comic' ? ' · Comic' : ''}</option>)}
                </select>
              </label>
              <button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Publish post'}</button>
            </div>
            {error && <p className="msg-err" role="alert">{error}</p>}
            <p className="fine">{body.length}/2000 characters. Keep it respectful and safe for the community.</p>
          </form>
        ) : (
          <p className="muted"><Link className="linkbtn" href="/login?next=%2Fcommunity">Log in</Link> or <Link className="linkbtn" href="/signup">create an account</Link> to join the conversation.</p>
        )}
      </section>

      <section className="stack">
        <div className="community-feed-head">
          <h2 className="h2">Community feed</h2>
          <span className="fine">{visiblePosts.length} {visiblePosts.length === 1 ? 'post' : 'posts'}</span>
        </div>
        <div className="community-categories" role="group" aria-label="Filter posts by category">
          {CATEGORIES.map(([id, label]) => <button key={id} type="button" className={'chip' + (category === id ? ' active' : '')}
            aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</button>)}
        </div>

        {posts === null && <p className="muted">Loading community posts…</p>}
        {posts && !loadError && visiblePosts.length === 0 && (
          <div className="empty"><div><b>No posts here yet.</b><p>Start a conversation and give the community something to talk about.</p></div></div>
        )}
        {visiblePosts.map((post) => {
          const mine = user && post.user_id === user.id;
          const topComments = (comments[post.id] || []).filter((c) => !c.parent_id);
          return (
            <article className="community-post" key={post.id}>
              <div className="community-post-head">
                <Avatar src={post.profiles && post.profiles.avatar_url} name={post.profiles ? post.profiles.name : 'Reader'} size="2.7rem" />
                <div className="community-post-by">
                  <b>{post.profiles ? post.profiles.name : 'Reader'}</b>
                  <span className="fine">{post.profiles ? '@' + post.profiles.username + ' · ' : ''}{timeLabel(post.created_at)}</span>
                </div>
                <span className="community-category">{LABELS[post.category] || 'General Lounge'}</span>
              </div>
              <p className="community-post-body">{post.body}</p>
              {post.books && <Link className="community-book-link" href={'/book/' + post.books.id}>📚 {post.books.title}{post.books.book_type === 'comic' ? ' · Comic' : ''} <span>Open story →</span></Link>}
              <div className="community-post-actions">
                <button className={'linkbtn' + (post.liked ? ' community-liked' : '')} type="button" onClick={() => toggleLike(post)} aria-pressed={post.liked}>♥ {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}</button>
                <button className="linkbtn" type="button" onClick={() => openComments[post.id] ? setOpenComments((old) => ({ ...old, [post.id]: false })) : loadComments(post.id)}>💬 {post.commentCount} replies</button>
                {mine && <button className="linkbtn" type="button" onClick={() => deletePost(post.id)}>Delete</button>}
                {!mine && <button className="linkbtn fine" type="button" onClick={() => reportPost(post.id)}>Report</button>}
              </div>
              {openComments[post.id] && (
                <div className="community-comments">
                  {comments[post.id] === null && <p className="fine">Loading replies…</p>}
                  {comments[post.id] && comments[post.id].length === 0 && <p className="fine">No replies yet. Start the conversation.</p>}
                  {(comments[post.id] || []).map((comment) => comment.parent_id ? null : (
                    <div className="community-comment" key={comment.id}>
                      <p className="fine"><b>{comment.profiles ? comment.profiles.name : 'Reader'}</b> · {timeLabel(comment.created_at)}</p>
                      <p>{comment.body}</p>
                      {(comments[post.id] || []).filter((reply) => reply.parent_id === comment.id).map((reply) => (
                        <div className="community-reply" key={reply.id}><p className="fine"><b>{reply.profiles ? reply.profiles.name : 'Reader'}</b> · {timeLabel(reply.created_at)}</p><p>{reply.body}</p></div>
                      ))}
                      {user && <form className="community-reply-form" onSubmit={(e) => { e.preventDefault(); addComment(post.id, comment.id); }}>
                        <input className="in" maxLength={1000} placeholder="Reply to this comment…" value={commentDrafts[post.id + comment.id] || ''} onChange={(e) => setCommentDrafts((old) => ({ ...old, [post.id + comment.id]: e.target.value }))} />
                        <button className="btn ghost small">Reply</button>
                      </form>}
                    </div>
                  ))}
                  {user && <form className="community-reply-form" onSubmit={(e) => { e.preventDefault(); addComment(post.id); }}>
                    <input className="in" maxLength={1000} placeholder="Write a reply…" value={commentDrafts[post.id] || ''} onChange={(e) => setCommentDrafts((old) => ({ ...old, [post.id]: e.target.value }))} />
                    <button className="btn small">Comment</button>
                  </form>}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
