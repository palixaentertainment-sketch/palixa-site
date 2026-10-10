'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import PublishLink from '@/components/PublishLink';
import { AuthProvider } from '@/lib/auth';
import Header from '@/components/Header';
import AuthHeader from '@/components/AuthHeader';
import Logo from '@/components/Logo';
import SocialLinks from '@/components/SocialLinks';
import MobileNav from '@/components/MobileNav';

export default function Providers({ children }) {
  const pathname = usePathname() || '/';
  const reading = pathname.startsWith('/read/');
  const signingIn = pathname.startsWith('/login') || pathname.startsWith('/signup');
  return (
    <AuthProvider>
      {reading ? (
        children
      ) : (
        <>
          {signingIn ? <AuthHeader /> : <Header />}
          <main className="wrap page">{children}</main>
          <footer className="wrap foot">
            <Logo size="footer" />
            <nav aria-label="Footer">
              <Link href="/discover">Discover</Link>
              <Link href="/community">Community</Link>
              <Link href="/categories">Categories</Link>
              <Link href="/authors">Authors</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact Us</Link>
              <PublishLink className="">Publish with Palixia</PublishLink>
            </nav>
            <div className="foot-social">
              <span className="fine">Follow Palixia</span>
              <SocialLinks compact />
            </div>
            <p className="fine">&copy; Palixia.</p>
          </footer>
          <MobileNav />
        </>
      )}
    </AuthProvider>
  );
}
