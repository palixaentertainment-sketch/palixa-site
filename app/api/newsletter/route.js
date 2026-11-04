import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const consent = body.consent === true;
    const honeypot = typeof body.website === 'string' ? body.website.trim() : '';

    // Quietly accept bot submissions without forwarding them to the mailing list.
    if (honeypot) {
      return NextResponse.json({ message: 'Thanks for your interest in Palixia.' });
    }

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (!consent) {
      return NextResponse.json({ error: 'Please confirm that you want to receive email updates.' }, { status: 400 });
    }

    const token = process.env.HOSTINGER_REACH_API_TOKEN;
    const profileUuid = process.env.HOSTINGER_REACH_PROFILE_ID;

    if (!token || !profileUuid) {
      console.error('[newsletter] Hostinger Reach environment variables are missing.');
      return NextResponse.json({ error: 'Newsletter signup is temporarily unavailable. Please try again later.' }, { status: 503 });
    }

    const reachResponse = await fetch(
      `https://developers.hostinger.com/api/reach/v1/profiles/${encodeURIComponent(profileUuid)}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          note: 'Palixia newsletter signup; email updates consent given on website.',
        }),
        cache: 'no-store',
      }
    );

    if (reachResponse.ok) {
      return NextResponse.json({
        message: 'Thanks for subscribing. If confirmation is required, please check your inbox.',
      });
    }

    const errorText = await reachResponse.text();
    if (reachResponse.status === 422 && /already exists|duplicate|already been taken|has already been/i.test(errorText)) {
      return NextResponse.json({
        message: 'This email may already be on our list. If it is subscribed, you will continue receiving Palixia updates.',
      });
    }

    console.error('[newsletter] Hostinger Reach rejected signup:', reachResponse.status, errorText.slice(0, 500));
    return NextResponse.json(
      { error: 'We could not complete your subscription right now. Please try again later.' },
      { status: 502 }
    );
  } catch (error) {
    console.error('[newsletter] Signup request failed:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
