// Only follow redirects that stay on this site.
export function safeNext(value, fallback) {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) return value;
  return fallback;
}
