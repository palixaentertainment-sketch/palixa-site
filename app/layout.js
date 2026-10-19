import './globals.css';
import Script from 'next/script';
import Providers from '@/components/Providers';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import VisitorTracker from '@/components/VisitorTracker';

export const metadata = {
  title: { default: 'Palixia', template: '%s | Palixia' },
  description: 'Read and publish stories on Palixia.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Mono&family=Instrument+Sans:wght@400;500;600;700;800;900&family=Literata:opsz,wght@7..72,400;7..72,600&display=swap"
        />
        {/* AdSense site verification script; ad placements will be added separately after approval. */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6489420167826250"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <Providers><VisitorTracker />{children}</Providers>
      </body>
    </html>
  );
}
