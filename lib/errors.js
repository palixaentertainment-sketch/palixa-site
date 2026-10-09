// Turn technical errors into messages a reader can act on. Raw database or API text is never shown.
export function friendly(error, fallback) {
  const base = fallback || 'Something went wrong. Please try again.';
  if (!error) return base;
  const msg = String(error.message || error);
  if (/failed to fetch|networkerror|network request|load failed/i.test(msg)) {
    return 'Network problem. Check your connection and try again.';
  }
  if (error.code === '23505') return 'That value is already in use. Try a different one.';
  if (/row-level security|permission denied|not authorized|jwt/i.test(msg)) {
    return 'You do not have permission to do that.';
  }
  if (/too large|exceeded the maximum|payload/i.test(msg)) return 'That file is too large.';
  if (/mime type|not supported|invalid.*type/i.test(msg)) {
    return 'That file type is not allowed. Use a JPG, PNG or WebP image.';
  }
  return base;
}

export function friendlyAuth(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = String(error.message || '');
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first. Check your inbox for the link.';
  if (/already registered|already exists/i.test(msg)) return 'An account with that email already exists. Try signing in.';
  if (/password/i.test(msg) && /(short|least|weak)/i.test(msg)) return 'Choose a longer password (at least 8 characters).';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|network/i.test(msg)) return 'Network problem. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

// Messages for "Continue with Google". Raw provider text is never shown.
export function friendlyOAuth(error) {
  const msg = String((error && error.message) || error || '');
  if (/access_denied|cancel|denied/i.test(msg)) return 'Google sign-in was cancelled. You can try again or use your email.';
  if (/provider is not enabled|unsupported provider|validation_failed/i.test(msg)) return 'Google sign-in is not set up yet. Please use your email and password.';
  if (/redirect|redirect_uri/i.test(msg)) return 'Google sign-in could not return to Palixia. Please use your email and password for now.';
  if (/failed to fetch|network/i.test(msg)) return 'Network problem. Check your connection and try again.';
  return 'Google sign-in did not work. Please try again or use your email.';
}
