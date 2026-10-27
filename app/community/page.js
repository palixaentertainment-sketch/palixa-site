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
  ['comics-art', 'Creative Corner'],
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
  const [feedQuery, setFeedQuery] = useState('');
  const [feedSort, setFeedSort] = useState('latest');
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  const [postCategory, setPostCategory] = useState('general');
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [bookId, setBookId] = useState('');
  const [books, setBooks] = useState([]);
  const [comments, setComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [sendingComment, setSendingComment] = useState({});
  const [commentErrors, setCommentErrors] = useState({});
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
      .select('id,user_id,category,body,image_url,book_id,created_at,profiles!community_posts_user_id_fkey(name,username,avatar_url),books(id,title,book_type),community_likes(user_id),community_comments(id),community_reposts(user_id)')
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
      repostCount: (post.community_reposts || []).length,
      reposted: Boolean(user && (post.community_reposts || []).some((item) => item.user_id === user.id)),
      liked: Boolean(user && (post.community_likes || []).some((like) => like.user_id === user.id)),
    })));
  }, [user]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (!configured) return;
    supabase.from('book_cards').select('id,title,book_type').order('title').limit(200)
      .then(({ data }) => setBooks(data || []));
  }, []);

  function handleImageChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Choose a JPG, PNG, WebP, or GIF image.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Images must be 5 MB or smaller.');
      e.target.value = '';
      return;
    }
    setError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function createPost(e) {
    e.preventDefault();
    if (!user) { setError('Log in to post in the Community.'); return; }
    if (!body.trim()) { setError('Write a caption or message before posting.'); return; }
    setBusy(true); setError(''); setNotice('');
    let imageUrl = null;
    let uploadedPath = null;

    if (imageFile) {
      const extension = imageFile.name.split('.').pop().toLowerCase();
      uploadedPath = user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.' + extension;
      const { error: uploadError } = await supabase.storage.from('community-images').upload(uploadedPath, imageFile, {
        cacheControl: '3600', contentType: imageFile.type, upsert: false,
      });
      if (uploadError) {
        console.error('Community image upload failed:', uploadError);
        setBusy(false);
        setError('The image could not be uploaded. Please check the Community image setup and try again.');
        return;
      }
      imageUrl = supabase.storage.from('community-images').getPublicUrl(uploadedPath).data.publicUrl;
    }

    const { error: insertError } = await supabase.from('community_posts').insert({
      user_id: user.id, category: postCategory,
      body: body.trim(), image_url: imageUrl, book_id: bookId || null,
    });
    if (insertError) {
      console.error('Community post could not be published:', insertError);
      if (uploadedPath) await supabase.storage.from('community-images').remove([uploadedPath]);
      setBusy(false);
      setError('Your post could not be published. Please check the Community image setup and try again.');
      return;
    }
    setBusy(false);
    setBody(''); setBookId(''); setPostCategory('general');
    setImageFile(null); setImagePreview('');
    const fileInput = document.getElementById('community-image');
    if (fileInput) fileInput.value = '';
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
    const key = postId + (parentId || '');
    const text = (commentDrafts[key] || '').trim();
    if (!user) { setCommentErrors((old) => ({ ...old, [key]: 'Please log in to reply.' })); return; }
    if (!text) { setCommentErrors((old) => ({ ...old, [key]: 'Type your comment first.' })); return; }
    if (sendingComment[key]) return;
    setSendingComment((old) => ({ ...old, [key]: true }));
    setCommentErrors((old) => ({ ...old, [key]: '' }));
    setNotice('');
    try {
      const { error: commentError } = await supabase.from('community_comments').insert({
        post_id: postId, user_id: user.id, parent_id: parentId, body: text,
      });
      if (commentError) throw commentError;
      setCommentDrafts((old) => ({ ...old, [key]: '' }));
      setComments((old) => ({ ...old, [postId]: null }));
      await loadComments(postId, true);
      await loadPosts();
    } catch (commentError) {
      console.error('Community comment could not be posted:', commentError);
      setCommentErrors((old) => ({ ...old, [key]: 'Could not send: ' + (commentError?.message || 'Please refresh and try again.') }));
    } finally {
      setSendingComment((old) => ({ ...old, [key]: false }));
    }
  }

  async function deletePost(postId) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    const { error: deleteError } = await supabase.from('community_posts').delete().eq('id', postId);
    if (deleteError) { setNotice('Could not delete this post.'); return; }
    setNotice('Post deleted.');
    await loadPosts();
  }

  async function repostPost(post) {
    if (!user) { setNotice('Log in to repost.'); return; }
    if (post.user_id === user.id) { setNotice('You cannot repost your own post.'); return; }
    const result = post.reposted
      ? await supabase.from('community_reposts').delete().eq('post_id', post.id).eq('user_id', user.id)
      : await supabase.from('community_reposts').insert({ post_id: post.id, user_id: user.id });
    if (result.error) {
      console.error('Community repost failed:', result.error);
      setNotice('Repost could not be saved. Please try again.');
      return;
    }
    setNotice(post.reposted ? 'Repost removed.' : 'Reposted to the Community.');
    await loadPosts();
  }

  async function blockUser(post) {
    if (!user) { setNotice('Log in to block an account.'); return; }
    if (post.user_id === user.id) return;
    const name = post.profiles?.name || 'this account';
    if (!window.confirm('Block ' + name + '? Their posts will be hidden from your Community feed.')) return;
    const { error: blockError } = await supabase.from('community_blocks').insert({ blocker_id: user.id, blocked_id: post.user_id });
    if (blockError && blockError.code !== '23505') {
      console.error('Community block failed:', blockError);
      setNotice('Could not block this account. Please try again.');
      return;
    }
    setBlockedUserIds((old) => old.includes(post.user_id) ? old : [...old, post.user_id]);
    setNotice(name + ' is now blocked.');
  }

  async function sharePost(postId) {
    const postUrl = window.location.origin + '/community#post-' + encodeURIComponent(postId);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Palixia Community post', url: postUrl });
        return;
      }
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(postUrl);
        setNotice('Post link copied!');
        return;
      }
    } catch (shareError) {
      if (shareError && shareError.name === 'AbortError') return;
      console.error('Could not share community post:', shareError);
    }
    window.prompt('Copy this link to share the post:', postUrl);
  }

  async function reportPost(postId) {
    await reportCommunityItem('community_post', postId, 'Briefly tell us why you are reporting this post:');
  }

  async function reportCommunityItem(targetType, targetId, promptText = 'Briefly tell us why you are reporting this item:') {
    if (!user) { setNotice('Log in to report this item.'); return; }
    const reason = window.prompt(promptText);
    if (reason === null) return;
    if (reason.trim().length < 3) { setNotice('Please enter a short reason for the report.'); return; }
    const { error: reportError } = await supabase.rpc('submit_moderation_report', {
      p_target_type: targetType, p_target_id: targetId, p_reason: reason.trim().slice(0, 500),
    });
    setNotice(reportError ? 'The report could not be saved. Please try again.' : 'Thank you. Your report has been submitted to Palixia moderation.');
  }

  const visiblePosts = (posts || [])
    .filter((post) => !blockedUserIds.includes(post.user_id))
    .filter((post) => category === 'all' || post.category === category)
    .filter((post) => {
      const q = feedQuery.trim().toLowerCase();
      if (!q) return true;
      return [post.body, post.profiles?.name, post.profiles?.username, LABELS[post.category]]
        .some((value) => String(value || '').toLowerCase().includes(q));
    })
    .sort((a, b) => feedSort === 'trending'
      ? ((b.likeCount * 2 + b.commentCount + (b.repostCount || 0) * 3) - (a.likeCount * 2 + a.commentCount + (a.repostCount || 0) * 3)) || new Date(b.created_at) - new Date(a.created_at)
      : new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="community stack">
      <section className="community-hero">
        <p className="mono">READ · PUBLISH · CONNECT</p>
        <h1 className="h1">The Palixia Community</h1>
        <p>Find your people, talk about the stories you love, and share what you’re creating.</p>
        <div className="community-hero-actions">
          <Link className="btn" href="/groups">Explore reading groups <span aria-hidden="true">→</span></Link>
          <span className="community-hero-note">A space for readers and writers at every stage.</span>
        </div>
      </section>

      {notice && <p className="notice" role="status">{notice}</p>}
      {loadError && (
        <div className="notice">
          <b>Community setup is not finished yet.</b>
          <p>The Community feed could not load. Your tables exist, so we’re checking the exact database error.</p><p className="fine">Technical detail: {loadErrorMessage || 'No details returned.'}</p>
        </div>
      )}

      <section className="community-daily">
        <div className="community-daily-icon" aria-hidden="true">✦</div>
        <div><p className="mono">TODAY’S CONVERSATION</p><h2>Which fictional character would you defend no matter what?</h2><p className="fine">Drop your answer in the feed and tell us why.</p></div>
        <button type="button" className="btn ghost small" onClick={() => { setBody((old) => old ? old : 'Which fictional character would you defend no matter what? My answer is… '); document.getElementById('community-body')?.focus(); }}>Join in</button>
      </section>

      <section className="community-compose">
        <div className="community-section-heading"><div><p className="mono">YOUR CORNER OF PALIXIA</p><h2 className="h2">Start a conversation</h2></div></div>
        {user ? (
          <form className="stack" onSubmit={createPost}>
            <div className="community-compose-head">
              <Avatar src={profile && profile.avatar_url} name={profile ? profile.name : 'You'} size="2.5rem" />
              <span><b>{profile ? profile.name : 'Your account'}</b><span className="fine">Share something with the community</span></span>
            </div>
            <label className="sr-only" htmlFor="community-body">Your post</label>
            <textarea id="community-body" className="in community-textarea" maxLength={2000} rows={4}
              placeholder="Share a thought, ask a question, or tell us what you’re creating…" value={body}
              onChange={(e) => setBody(e.target.value)} />
            <div className="community-image-picker">
              <label className="btn ghost small" htmlFor="community-image">＋ Add image</label>
              <input id="community-image" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange} disabled={busy} />
              <span className="fine">JPG, PNG, WebP or GIF · up to 5 MB</span>
              {imagePreview && (
                <div className="community-image-preview">
                  <img src={imagePreview} alt="Preview of the image attached to your post" />
                  <button type="button" className="linkbtn" onClick={() => {
                    setImageFile(null); setImagePreview('');
                    const input = document.getElementById('community-image');
                    if (input) input.value = '';
                  }} disabled={busy}>Remove image</button>
                </div>
              )}
            </div>
            <div className="community-compose-controls">
              <label className="field community-field"><span className="sr-only">Choose a category</span>
                <select className="in" value={postCategory} onChange={(e) => setPostCategory(e.target.value)} aria-label="Post category">
                  {CATEGORIES.filter(([id]) => id !== 'all').map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <label className="field community-field"><span className="sr-only">Attach a book or comic</span>
                <select className="in" value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Attach a published book">
                  <option value="">No book attached</option>
                  {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
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
          <div><p className="mono">WHAT’S HAPPENING</p><h2 className="h2">Community feed</h2></div>
          <span className="community-count">{visiblePosts.length} {visiblePosts.length === 1 ? 'post' : 'posts'}</span>
        </div>
        <div className="community-feed-tools">
          <label className="community-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search community posts</span><input value={feedQuery} onChange={(e) => setFeedQuery(e.target.value)} placeholder="Search conversations…" /></label>
          <div className="community-sort" role="group" aria-label="Sort community posts">
            <button type="button" aria-pressed={feedSort === 'latest'} className={feedSort === 'latest' ? 'selected' : ''} onClick={() => setFeedSort('latest')}>Latest</button>
            <button type="button" aria-pressed={feedSort === 'trending'} className={feedSort === 'trending' ? 'selected' : ''} onClick={() => setFeedSort('trending')}>Trending</button>
          </div>
        </div>
        <div className="community-categories" role="group" aria-label="Filter posts by category">
          {CATEGORIES.map(([id, label]) => <button key={id} type="button" className={'chip' + (category === id ? ' active' : '')}
            aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</button>)}
        </div>

        {posts === null && <p className="muted">Loading community posts…</p>}
        {posts && !loadError && visiblePosts.length === 0 && (
          <div className="empty"><div><b>Nothing to show just yet.</b><p>{feedQuery ? 'Try another search or clear the search box.' : 'Be the first to start a conversation in this corner of Palixia.'}</p></div></div>
        )}
        {visiblePosts.map((post) => {
          const mine = user && post.user_id === user.id;
          const topComments = (comments[post.id] || []).filter((c) => !c.parent_id);
          return (
            <article className="community-post" id={"post-" + post.id} key={post.id}>
              <div className="community-post-head">
                <Avatar src={post.profiles && post.profiles.avatar_url} name={post.profiles ? post.profiles.name : 'Reader'} size="2.7rem" />
                <div className="community-post-by">
                  <b>{post.profiles ? post.profiles.name : 'Reader'}</b>
                  <span className="fine">{post.profiles ? '@' + post.profiles.username + ' · ' : ''}{timeLabel(post.created_at)}</span>
                </div>
                <span className="community-category">{LABELS[post.category] || 'General Lounge'}</span>
              </div>
              <p className="community-post-body">{post.body}</p>
              {post.image_url && <a className="community-post-image-link" href={post.image_url} target="_blank" rel="noreferrer" aria-label="Open attached image in full size"><img className="community-post-image" src={post.image_url} alt={'Image shared by ' + (post.profiles ? post.profiles.name : 'a community member')} loading="lazy" /></a>}
              {post.books && <Link className="community-book-link" href={'/book/' + post.books.id}>📚 {post.books.title} <span>Open story →</span></Link>}
              <div className="community-post-actions">
                <button className={'linkbtn' + (post.liked ? ' community-liked' : '')} type="button" onClick={() => toggleLike(post)} aria-pressed={post.liked}>♥ {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}</button>
                <button className="linkbtn" type="button" onClick={() => openComments[post.id] ? setOpenComments((old) => ({ ...old, [post.id]: false })) : loadComments(post.id)}>💬 {post.commentCount} replies</button>
                <button className={'linkbtn community-repost-action' + (post.reposted ? ' is-reposted' : '')} type="button" onClick={() => repostPost(post)} aria-pressed={Boolean(post.reposted)} title="Repost to the Community">🔁 {post.repostCount || 0} {post.repostCount === 1 ? 'repost' : 'reposts'}</button>
                <button className="linkbtn" type="button" onClick={() => sharePost(post.id)} aria-label="Share post link" title="Share post link">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
                    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </button>
                {mine && <button className="linkbtn" type="button" onClick={() => deletePost(post.id)}>Delete</button>}
                {!mine && <button className="linkbtn fine" type="button" onClick={() => blockUser(post)}>Block user</button><button className="linkbtn fine" type="button" onClick={() => reportPost(post.id)}>Report</button>}
              </div>
              {openComments[post.id] && (
                <div className="community-comments">
                  {comments[post.id] === null && <p className="fine">Loading replies…</p>}
                  {comments[post.id] && comments[post.id].length === 0 && <p className="fine">No replies yet. Start the conversation.</p>}
                  {(comments[post.id] || []).map((comment) => comment.parent_id ? null : (
                    <div className="community-comment" key={comment.id}>
                      <p className="fine"><b>{comment.profiles ? comment.profiles.name : 'Reader'}</b> · {timeLabel(comment.created_at)}</p>
                      <p>{comment.body}</p>
                      {user && user.id !== comment.user_id && <button type="button" className="linkbtn fine" onClick={() => reportCommunityItem('community_comment', comment.id, 'Why are you reporting this comment?')}>Report comment</button>}
                      {(comments[post.id] || []).filter((reply) => reply.parent_id === comment.id).map((reply) => (
                        <div className="community-reply" key={reply.id}><p className="fine"><b>{reply.profiles ? reply.profiles.name : 'Reader'}</b> · {timeLabel(reply.created_at)}</p><p>{reply.body}</p>{user && user.id !== reply.user_id && <button type="button" className="linkbtn fine" onClick={() => reportCommunityItem('community_comment', reply.id, 'Why are you reporting this reply?')}>Report reply</button>}</div>
                      ))}
                      {user && <form className="community-reply-form" onSubmit={(e) => { e.preventDefault(); addComment(post.id, comment.id); }}>
                        <input className="in" maxLength={1000} placeholder="Reply to this comment…" value={commentDrafts[post.id + comment.id] || ''} onChange={(e) => setCommentDrafts((old) => ({ ...old, [post.id + comment.id]: e.target.value }))} />
                        <button type="submit" className="btn ghost small" disabled={Boolean(sendingComment[post.id + comment.id])}>{sendingComment[post.id + comment.id] ? 'Sending…' : 'Reply'}</button>
                        {commentErrors[post.id + comment.id] && <p className="msg-err" role="alert">{commentErrors[post.id + comment.id]}</p>}
                      </form>}
                    </div>
                  ))}
                  {user && <form className="community-reply-form" onSubmit={(e) => { e.preventDefault(); addComment(post.id); }}>
                    <input className="in" maxLength={1000} placeholder="Write a reply…" value={commentDrafts[post.id] || ''} onChange={(e) => setCommentDrafts((old) => ({ ...old, [post.id]: e.target.value }))} />
                    <button type="submit" className="btn small" disabled={Boolean(sendingComment[post.id])}>{sendingComment[post.id] ? 'Sending…' : 'Comment'}</button>
                    {commentErrors[post.id] && <p className="msg-err" role="alert">{commentErrors[post.id]}</p>}
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
