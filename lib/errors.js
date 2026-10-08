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
