'use client';

import { useEffect, useState } from 'react';

function isStandalone() {
  return (typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  ));
}

export function openInstallApp() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('palixia:open-install'));
  }
}

export default function InstallAppPrompt() {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setInstalled(isStandalone());
    if (isStandalone()) document.documentElement.classList.add("palixia-standalone");
    const ua = window.navigator.userAgent || '';
    setIos(/iphone|ipad|ipod/i.test(ua) && !window.MSStream);

    const beforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      document.documentElement.classList.add("palixia-standalone");
      setOpen(false);
      setInstallPrompt(null);
    };
    const onOpen = () => {
      if (!isStandalone()) {
        setMessage('');
        setOpen(true);
      }
    };

    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('palixia:open-install', onOpen);
    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = () => {
      const standalone = isStandalone();
      setInstalled(standalone);
      document.documentElement.classList.toggle("palixia-standalone", standalone);
    };
    media.addEventListener?.('change', onDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('palixia:open-install', onOpen);
      media.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstalled(true);
        setOpen(false);
      }
      setInstallPrompt(null);
      return;
    }
    if (ios) {
      setMessage('To install Palixia, tap the Share button in Safari, then choose “Add to Home Screen” and tap Add.');
    } else {
      setMessage('To install Palixia, open your browser menu (⋮) and choose “Install app” or “Add to Home screen,” if available.');
    }
  }

  if (installed) return null;

  return (
    <>
      {open && (
        <div className="install-overlay" role="presentation" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}>
          <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
            <button className="install-close" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            <img src="/brand/icon-192.png" alt="" className="install-icon" />
            <p className="mono">READ. DISCOVER. PUBLISH.</p>
            <h2 id="install-title">Take Palixia with you.</h2>
            <p className="muted">Keep your favourite stories one tap away. Add Palixia to your home screen for a more app-like experience.</p>
            {message && <p className="install-help" role="status">{message}</p>}
            <button className="btn install-primary" type="button" onClick={install}>Install Palixia</button>
            <button className="install-later" type="button" onClick={() => setOpen(false)}>Maybe later</button>
          </section>
        </div>
      )}
    </>
  );
}
