// Gives each published book a branded preview when its link is shared.
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
    const book = rows && rows[0];
    if (!book) return {};

    const title = book.title + (book.author_name ? ' by ' + book.author_name : '');
    const description = (book.description || 'Read ' + book.title + ' on Palixia.')
      .replace(/\\s+/g, ' ')
      .slice(0, 160);
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://palixia.com').replace(/\\/$/, '');
    const imageUrl = siteUrl + '/api/book-preview/' + params.id;
    const image = [{ url: imageUrl, width: 1200, height: 630, alt: book.title + ' on Palixia' }];

    return {
      title: book.title,
      description,
      openGraph: { title, description, type: 'book', siteName: 'Palixia', images: image },
      twitter: { card: 'summary_large_image', title, description, images: image },
    };
  } catch (error) {
    return {};
  }
}

export default function BookLayout({ children }) {
  return children;
}
