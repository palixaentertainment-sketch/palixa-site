'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Keep local development unaffected; register the worker on deployed builds only.
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Palixia service worker registration failed:', error);
    });
  }, []);

  return null;
}
