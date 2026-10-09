// Gives each book its own title, description and cover when its link is shared on WhatsApp, X and similar.
// Only published books are visible to this lookup, so drafts never leak into previews.
export async function generateMetadata({ params }) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key || !/^[0-9a-f-]{36}$/i.test(params.id)) return {};
  try {
    const res = await fetch(
      base + '/rest/v1/book_cards?id=eq.' + params.id + '&select=title,description,cover_url,author_name&limit=1',
      { headers: { apikey: key, Authorization: 'Bearer ' + key }, next: { revalidate: 300 } }
    );
    if (!res.ok) return {};
    const rows = await res.json();
    const b = rows && rows[0];
    if (!b) return {};
    const title = b.title + (b.author_name ? ' by ' + b.author_name : '');
    const description = (b.description || 'Read ' + b.title + ' on Palixia.').replace(/\s+/g, ' ').slice(0, 160);
    const image = b.cover_url && /^https:\/\//.test(b.cover_url) ? [b.cover_url] : undefined;
    return {
      title: b.title,
      description,
      openGraph: { title, description, type: 'book', siteName: 'Palixia', images: image },
      twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image },
    };
  } catch (e) {
    return {};
  }
}

export default function BookLayout({ children }) {
  return children;
}
