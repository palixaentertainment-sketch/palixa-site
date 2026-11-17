'use client';
import { useEffect, useState } from 'react';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function ComingSoonPreview({ book }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (!open || !user || !configured) return () => { active = false; };
    supabase.from('coming_soon_subscriptions').select('id')
      .eq('coming_soon_book_id', book.id).eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (active) setSubscribed(!!data); });
    return () => { active = false; };
  }, [open, user?.id, book.id]);

  async function notifyMe() {
    if (!user) {
      window.location.href = '/login?next=' + encodeURIComponent('/');
      return;
    }
    setBusy(true); setMessage('');
    const { error } = await supabase.from('coming_soon_subscriptions')
      .upsert({ coming_soon_book_id: book.id, user_id: user.id }, { onConflict: 'coming_soon_book_id,user_id', ignoreDuplicates: true });
    if (error) setMessage('Could not save your reminder. Please try again.');
    else { setSubscribed(true); setMessage('You’ll be notified when this book is released.'); }
    setBusy(false);
  }

  return <>
    <button type="button" className="coming-soon-preview-trigger" onClick={() => { setOpen(true); setMessage(''); }} aria-label={'Preview ' + book.title}>
      <span aria-hidden="true">⌕</span><span>Preview</span>
    </button>
    {open && <div className="coming-soon-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section className="coming-soon-dialog" role="dialog" aria-modal="true" aria-labelledby={'cs-title-' + book.id}>
        <button type="button" className="coming-soon-close" onClick={() => setOpen(false)} aria-label="Close preview">×</button>
        <div className="coming-soon-dialog-main">
          <img src={book.cover_url} alt={book.title + ' cover'} />
          <div className="stack">
            <span className="badge">COMING SOON</span>
            <h2 className="h2" id={'cs-title-' + book.id}>{book.title}</h2>
            <p className="fine">by {book.author_name}</p>
            {book.release_date && <p className="fine">Expected {new Date(book.release_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>}
            <p className="coming-soon-description">{book.description || 'A new story is on its way to Palixia. Check back soon.'}</p>
            <button type="button" className={subscribed ? 'btn on' : 'btn'} onClick={notifyMe} disabled={busy || subscribed}>
              {busy ? 'Saving…' : subscribed ? '✓ You’ll be notified' : '♧ Notify me when it drops'}
            </button>
            {message && <p className="fine" role="status">{message}</p>}
            {!user && <p className="fine">Log in to save a release reminder.</p>}
          </div>
        </div>
      </section>
    </div>}
  </>;
}
