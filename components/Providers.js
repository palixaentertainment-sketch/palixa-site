'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider } from '@/lib/auth';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';

export default function Providers({ children }) {
  const pathname = usePathname() || '/';
  const reading = pathname.startsWith('/read/');
  return (
    <AuthProvider>
      {reading ? (
        children
      ) : (
        <>
          <Header />
          <main className="wrap page">{children}</main>
          <footer className="wrap foot">
            <nav aria-label="Footer">
              <Link href="/discover">Discover</Link>
              <Link href="/categories">Categories</Link>
              <Link href="/authors">Authors</Link>
              <Link href="/about">About</Link>
              <Link href="/signup?as=author">Publish with Palixa</Link>
            </nav>
            <p className="fine">&copy; Palixa. Stories worth discovering.</p>
          </footer>
          <MobileNav />
        </>
      )}
    </AuthProvider>
  );
}
