'use client';
import { useEffect, useState } from 'react';
import { supabase, configured } from '@/lib/supabase';
import { friendlyOAuth } from '@/lib/errors';

// Reads an error that Supabase or Google sent back in the address bar after a failed or cancelled
// Google sign-in, shows it through setErr, then tidies the address.
export function useOAuthReturnError(setErr) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = url.searchParams.get('error_code') || hash.get('error_code') || '';
    const error = url.searchParams.get('error') || hash.get('error') || '';
    const text = url.searchParams.get('error_description') || hash.get('error_description') || '';
    if (!error && !code) return;
    setErr(friendlyOAuth({ message: error + ' ' + code + ' ' + text }));
    ['error', 'error_code', 'error_description'].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, '', url.pathname + (url.search || '') );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// "Continue with Google". Works on both the login and signup screens.
// After Google, the person comes back to `returnTo`, where the existing redirect logic takes over.
export default function GoogleButton({ returnTo, onError }) {
  const [busy, setBusy] = useState(false);

  async function go() {
    onError('');
    if (!configured) { onError('Palixia is not connected to its database yet. See README.md.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + returnTo,
        queryParams: { prompt: 'select_account' },
      },
    });
    // On success the browser is already leaving for Google, so there is nothing more to do here.
    if (error) { setBusy(false); onError(friendlyOAuth(error)); }
  }

  return (
    <section className="oauth">
      <button type="button" className="btn ghost" onClick={go} disabled={busy}>
        <GoogleMark />
        {busy ? 'Opening Google...' : 'Continue with Google'}
      </button>
      <p className="orline" aria-hidden="true"><span>or</span></p>
    </section>
  );
}
