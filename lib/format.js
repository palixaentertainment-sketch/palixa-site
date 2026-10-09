export function fmtNum(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function cleanFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function validUsername(u) {
  return /^[a-z0-9_]{3,24}$/.test(u);
}

export function typeLabel(t) {
  return t === 'comic' ? 'Comic' : 'Book';
}

// Public read counts are hidden for now. Set to true to show them again on book cards, book pages and author pages.
// Authors still see their own numbers on their dashboard either way.
export const SHOW_PUBLIC_READS = false;
