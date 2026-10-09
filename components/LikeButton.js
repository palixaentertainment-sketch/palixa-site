'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fmtNum } from '@/lib/format';

export default function LikeButton({ kind, id, count = 0, authorId }) {
  const { user } = useAuth();
  const table = kind === 'chapter' ? 'chapter_likes' : 'book_likes';
  const col = kind === 'chapter' ? 'chapter_id' : 'book_id';
  const [liked, setLiked] = useState(false);
  const [total, setTotal] = useState(count || 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { setTotal(count || 0); }, [count, id]);
  useEffect(() => {
    setLiked(false);
    if (!user || !id) return;
    let active = true;
    supabase.from(table).select(col).eq('user_id', user.id).eq(col, id).maybeSingle()
      .then(({ data }) => { if (active) setLiked(Boolean(data)); });
    return () => { active = false; };
  }, [user, id, table, col]);
  async function toggle() {
    if (!user) { setMsg('Log in to like this.'); return; }
    if (busy) return;
    setBusy(true); setMsg('');
    const result = liked
      ? await supabase.from(table).delete().eq('user_id', user.id).eq(col, id)
      : await supabase.from(table).insert({ user_id: user.id, [col]: id });
    if (result.error) {
      setMsg(result.error.code === '23505' ? 'You have already liked this.' : 'Could not save your like. Please try again.');
    } else {
      setLiked(!liked);
      setTotal((n) => Math.max(0, n + (liked ? -1 : 1)));
    }
    setBusy(false);
  }
  if (user && authorId && user.id === authorId) {
    return <span className="fine">{total ? fmtNum(total) + (total === 1 ? ' like' : ' likes') : ''}</span>;
  }
  return <span className="likewrap">
    <button type="button" className={'btn ghost' + (liked ? ' on' : '')} aria-pressed={liked} onClick={toggle} disabled={busy}>
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {liked ? 'Liked' : 'Like'}{total ? ' · ' + fmtNum(total) : ''}
    </button>
    {msg && <span className="msg-err" role="alert">{msg} {!user && <Link className="linkbtn" href={'/login?next=' + (typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname) : '/')}>Log in</Link>}</span>}
  </span>;
}
