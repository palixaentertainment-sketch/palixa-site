'use client';

import { useState } from 'react';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setMessage('');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent, website }),
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(result.error || 'We could not add you to the mailing list. Please try again.');
        return;
      }

      setStatus('success');
      setMessage(result.message || 'Thanks for subscribing. Please check your inbox for any confirmation email.');
      setEmail('');
      setConsent(false);
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please check your connection and try again.');
    }
  }

  return (
    <section className="newsletter-signup" aria-labelledby="newsletter-heading">
      <div className="newsletter-copy">
        <span className="newsletter-eyebrow">THE PALIXIA LETTER</span>
        <h2 id="newsletter-heading">Stay in the story.</h2>
        <p>Get occasional updates about new stories, featured authors and what’s happening on Palixia.</p>
      </div>
      <form className="newsletter-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="newsletter-email">Email address</label>
        <div className="newsletter-input-row">
          <input
            id="newsletter-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Your email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
            disabled={status === 'submitting'}
          />
          <button className="btn" type="submit" disabled={status === 'submitting' || !consent}>
            {status === 'submitting' ? 'Joining…' : 'Subscribe'}
          </button>
        </div>
        <label className="newsletter-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            disabled={status === 'submitting'}
            required
          />
          <span>I agree to receive occasional email updates from Palixia. I can unsubscribe at any time.</span>
        </label>
        <div className="newsletter-honeypot" aria-hidden="true">
          <label htmlFor="newsletter-website">Leave this field empty</label>
          <input
            id="newsletter-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>
        <p className={`newsletter-message ${status}`} role="status" aria-live="polite">{message}</p>
      </form>
    </section>
  );
}
