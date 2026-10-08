// Card colours for the genre tiles. Keyed by genre slug.
export const GENRE_COLORS = {
  romance: ['#4c1d95', '#a855f7'],
  thriller: ['#1e1b4b', '#6d28d9'],
  crime: ['#2e1065', '#7c3aed'],
  mystery: ['#312e81', '#8b5cf6'],
  fantasy: ['#3b0764', '#9333ea'],
  horror: ['#1b0b3a', '#5b21b6'],
  drama: ['#4338ca', '#a78bfa'],
  'sci-fi': ['#240b54', '#6d28d9'],
  'short-stories': ['#4c1d95', '#7c3aed'],
  comics: ['#2e1065', '#a855f7'],
};

export function genreStyle(slug) {
  const c = GENRE_COLORS[slug] || ['#2e1065', '#6d28d9'];
  return { '--g1': c[0], '--g2': c[1] };
}
