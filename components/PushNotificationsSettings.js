'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export default function PushNotificationsSettings({ user }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [testTitle, setTestTitle] = useState('Palixia push notifications are working');
  const [testMessage, setTestMessage] = useState('You can now receive updates from Palixia, even when the website is closed.');

  useEffect(() => {
    const available = typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
    setSupported(available);
    if (!available) return;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(Boolean(subscription)))
      .catch(() => {});
  }, []);

  async function enablePush() {
    setError('');
    setNotice('');
    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError('Push notifications are not configured on Palixia yet.');
      return;
    }
    if (!supported) {
      setError('Push notifications are not supported in this browser.');
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError(permission === 'denied'
          ? 'Notifications are blocked in your browser settings. Change that permission and try again.'
          : 'Notification permission was not granted.');
        setBusy(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const { error: saveError } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
        user_agent: navigator.userAgent,
        enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
      if (saveError) throw saveError;
      setEnabled(true);
      setNotice('Notifications are enabled on this device.');
    } catch (e) {
      setError(e?.message || 'We could not enable push notifications. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setNotice('Push notifications are turned off on this device.');
    } catch (e) {
      setError(e?.message || 'Could not turn notifications off. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Please sign in again to send a test notification.');
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: testTitle.trim() || 'Palixia',
          message: testMessage.trim() || 'A test push notification.',
          image: imageUrl.trim() || null,
          url: '/notifications',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Test notification failed.');
      setNotice(result.message || 'Test notification sent.');
    } catch (e) {
      setError(e?.message || 'Test notification could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <div className="stack" style={{ gap: '.35rem' }}>
        <h2 className="h2">Push notifications</h2>
        <p className="muted">Receive Palixia updates on this device, even when you are not browsing the website.</      </p>
      </div>
      {!supported && <p className="notice">Push notifications are not supported by this browser. Try a supported browser on this device.</p>}
      {supported && (
        <div className="row">
          {enabled
            ? <button type="button" className="btn ghost" onClick={disablePush} disabled={busy}>{busy ? 'Please wait…' : 'Turn off on this device'}</button>
            : <button type="button" className="btn" onClick={enablePush} disabled={busy}>{busy ? 'Please wait…' : 'Enable push notifications'}</button>}
        </div>
      )}
      {enabled && (
        <div className="stack" style={{ gap: '.8rem' }}>
          <p className="fine">Send a test to confirm that rich push notifications are reaching this device.</p>
          <div className="field">
            <label htmlFor="palixia-push-test-title">Title</label>
            <input id="palixia-push-test-title" className="in" maxLength={80} value={testTitle} onChange={(e) => setTestTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="palixia-push-test-message">Message</label>
            <textarea id="palixia-push-test-message" className="in" maxLength={180} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={3} />
          </div>
          <div className="field">
            <label htmlFor="palixia-push-test-image">Large image URL (optional)</label>
            <input id="palixia-push-test-image" className="in" type="url" placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <span className="fine">Use a public HTTPS image to test the expanded notification layout.</span>
          </div>
          <button type="button" className="btn" onClick={sendTest} disabled={busy}>{busy ? 'Sending…' : 'Send test notification'}</button>
        </div>
      )}
      {notice && <p className="msg-ok" role="status">{notice}</p>}
      {error && <p className="msg-err" role="alert">{error}</p>}
    </section>
  );
}
