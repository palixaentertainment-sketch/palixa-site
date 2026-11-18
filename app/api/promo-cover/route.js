import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request) {
  const raw = new URL(request.url).searchParams.get('url');
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!raw || !configuredUrl) {
    return NextResponse.json({ error: 'Cover unavailable.' }, { status: 400 });
  }

  let imageUrl;
  let projectUrl;
  try {
    imageUrl = new URL(raw);
    projectUrl = new URL(configuredUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid cover URL.' }, { status: 400 });
  }

  // Only proxy public images from this project's Supabase Storage.
  if (
    imageUrl.protocol !== 'https:' ||
    imageUrl.host !== projectUrl.host ||
    !imageUrl.pathname.startsWith('/storage/v1/object/public/')
  ) {
    return NextResponse.json({ error: 'Unsupported cover source.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(imageUrl.toString(), {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*' },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Cover could not be loaded.' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || '';
    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (!contentType.startsWith('image/') || (contentLength && contentLength > 8 * 1024 * 1024)) {
      return NextResponse.json({ error: 'Invalid cover image.' }, { status: 415 });
    }

    const bytes = await upstream.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Cover image is too large.' }, { status: 413 });
    }

    return new Response(bytes, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Cover could not be loaded.' }, { status: 502 });
  }
}
