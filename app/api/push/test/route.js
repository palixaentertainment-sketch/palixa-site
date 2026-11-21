import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const runtime = 'nodejs';

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://palixa.com';

function safeTarget(value) {
  if (typeof value !== 'string' || !value.trim()) return '/notifications';
  try {
    const target = new URL(value, SITE_ORIGIN);
    if (target.origin !== SITE_ORIGIN || !['https:', 'http:'].includes(target.protocol)) return '/notifications';
    return target.pathname + target.search + target.hash;
  } catch {
    return '/notifications';
  }
}

function safeImage(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const image = new URL(value);
    if (image.protocol !== 'https:' || image.username || image.password) return undefined;
    return image.toString();
  } catch {
    return undefined;
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const vapidPublic = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:info@palixia.com';

    if (!token || !supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Authentication or push configuration is missing.' }, { status: 401 });
    }
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: 'Push notifications are not configured on the server yet.' }, { status: 503 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : 'Palixia';
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 180) : '';
    if (!title || !message) {
      return NextResponse.json({ error: 'A title and message are required.' }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: subscriptions, error: queryError } = await admin
      .from('push_subscriptions')
      .select('endpoint,subscription')
      .eq('user_id', authData.user.id)
      .eq('enabled', true);

    if (queryError) {
      console.error('[push-test] Subscription lookup failed:', queryError.message);
      return NextResponse.json({ error: 'Could not find this device subscription. Please enable push again.' }, { status: 500 });
    }
    if (!subscriptions?.length) {
      return NextResponse.json({ error: 'No active push subscription found. Enable push notifications on this device first.' }, { status: 409 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const payload = {
      title,
      body: message,
      icon: '/brand/icon-192.png',
      badge: '/brand/icon-192.png',
      image: safeImage(body.image),
      url: safeTarget(body.url),
      tag: 'palixia-push-test',
      actions: [
        { action: 'open', title: 'Open Palixia' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    let delivered = 0;
    let expired = 0;
    const results = await Promise.all(subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload));
        delivered += 1;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          expired += 1;
          await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
        } else {
          console.error('[push-test] Delivery failed:', error?.statusCode || error?.message || error);
        }
      }
    }));

    if (!delivered) {
      return NextResponse.json({ error: 'Push delivery failed. Check browser permission and VAPID configuration.' }, { status: 502 });
    }
    return NextResponse.json({
      message: delivered === 1 ? 'Test push sent to this device.' : `Test push sent to ${delivered} devices.`,
      delivered,
      expired,
    });
  } catch (error) {
    console.error('[push-test] Request failed:', error);
    return NextResponse.json({ error: 'Something went wrong sending the test notification.' }, { status: 500 });
  }
}
