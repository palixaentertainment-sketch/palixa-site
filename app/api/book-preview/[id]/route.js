import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://palixia.com').replace(/\\/$/, '');

export async function GET(_request, { params }) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!base || !key || !UUID_PATTERN.test(params.id)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const response = await fetch(
      base + '/rest/v1/book_cards?id=eq.' + params.id + '&select=title,description,cover_url,author_name&limit=1',
      {
        headers: { apikey: key, Authorization: 'Bearer ' + key },
        cache: 'no-store',
      }
    );

    if (!response.ok) return new Response('Not found', { status: 404 });

    const rows = await response.json();
    const book = rows && rows[0];
    if (!book) return new Response('Not found', { status: 404 });

    const coverUrl = book.cover_url && /^https:\\/\\//.test(book.cover_url)
      ? book.cover_url
      : null;
    const title = String(book.title || 'A story on Palixia').slice(0, 100);
    const author = String(book.author_name || 'Independent author').slice(0, 70);
    const description = String(book.description || 'Discover and read this story for free on Palixia.')
      .replace(/\\s+/g, ' ')
      .slice(0, 190);
    const iconUrl = SITE_URL + '/brand/icon-512.png';

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            position: 'relative',
            padding: '48px',
            background: 'linear-gradient(135deg, #f8f6ff 0%, #ffffff 58%, #f1edff 100%)',
            color: '#211a35',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <div
            style={{
              width: '350px',
              height: '534px',
              display: 'flex',
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRadius: '18px',
              background: '#e9e2ff',
              boxShadow: '0 12px 36px rgba(40, 25, 70, 0.16)',
            }}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                width="350"
                height="534"
                style={{ width: '350px', height: '534px', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '30px',
                  color: '#5a438c',
                  fontSize: '36px',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                {title}
              </div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 28px 42px 48px',
            }}
          >
            <div
              style={{
                display: 'flex',
                color: '#7252b5',
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '3px',
                marginBottom: '24px',
              }}
            >
              A STORY ON PALIXIA
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '52px',
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: '-1.5px',
                marginBottom: '18px',
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: 'flex',
                color: '#705e8e',
                fontSize: '25px',
                marginBottom: '28px',
              }}
            >
              by {author}
            </div>
            <div
              style={{
                display: 'flex',
                color: '#625b70',
                fontSize: '22px',
                lineHeight: 1.45,
                maxHeight: '130px',
                overflow: 'hidden',
              }}
            >
              {description}
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              right: '48px',
              bottom: '30px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 16px 9px 10px',
              borderRadius: '999px',
              background: '#ffffff',
              border: '1px solid #e6def6',
              color: '#4c347c',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '1px',
            }}
          >
            <img src={iconUrl} width="34" height="34" style={{ borderRadius: '8px' }} />
            PALIXIA
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (error) {
    return new Response('Unable to generate book preview', { status: 500 });
  }
}
