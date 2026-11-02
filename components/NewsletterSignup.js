'use client';

import { useState } from 'react';
import { configured, supabase } from '@/lib/supabase';

const STORAGE_KEY = 'palixia-letters-subscription';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function subscribe(event) {
    event.preventDefault();
    setStatus('');
    if (!configured) {
      setStatus('Newsletter signup is temporarily unavailable. Please try again later.');
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc('subscribe_palixia_letters', {
      p_email: email.trim().toLowerCase(),
      p_subscriber_type: 'general',
      p_source: 'footer',
    });
    setBusy(false);

    if (error || !data) {
      setStatus('We could not complete your subscription. Please try again.');
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: email.trim().toLowerCase(), token: data }));
      setSaved(true);
    } catch {
      // Subscription is still successful if browser storage is unavailable.
    }
    setEmail('');
    setStatus('You’re on the list. Welcome to Palixia Letters!');
  }

  async function unsubscribe() {
    let savedSubscription;
    try {
      savedSubscription = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      savedSubscription = null;
    }
    if (!savedSubscription?.token) return;

    setBusy(true);
    const { data, error } = await supabase.rpc('unsubscribe_palixia_letters', {
      p_token: savedSubscription.token,
    });
    setBusy(false);
    if (error || !data) {
      setStatus('We could not process that unsubscribe request. Please try again.');
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
    setStatus('You have been unsubscribed from Palixia Letters.');
  }

  return (
    <section className="letters-signup" aria-labelledby="letters-title">
      <div className="letters-copy">
        <span className="letters-eyebrow">PALIXIA LETTERS</span>
        <h2 id="letters-title">Stay in the loop.</h2>
        <p>New stories, exciting authors, community updates and a few things happening around Palixia.</p>
        <span className="letters-note">No spam. Just updates worth knowing.</span>
      </div>
      <div className="letters-form-wrap">
        <form className="letters-form" onSubmit={subscribe}>
          <label className="sr-only" htmlFor="letters-email">Email address</label>
          <input
            id="letters-email"
            className="in"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="Your email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : 'Subscribe'}
          </button>
        </form>
        <p className="letters-status" role="status" aria-live="polite">{status}</p>
        {saved && (
          <button className="letters-unsubscribe" type="button" onClick={unsubscribe} disabled={busy}>
            Unsubscribe on this device
          </button>
        )}
      </div>
    </section>
  );
}
