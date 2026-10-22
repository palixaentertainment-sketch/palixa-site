'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import PublishLink from '@/components/PublishLink';
import { AuthProvider } from '@/lib/auth';
import Header from '@/components/Header';
import AuthHeader from '@/components/AuthHeader';
import Logo from '@/components/Logo';
import SocialLinks from '@/components/SocialLinks';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import MobileNav from '@/components/MobileNav';

export default function Providers({ children }) {
  const pathname = usePathname() || '/';
  const reading = pathname.startsWith('/read/');
  const signingIn = pathname.startsWith('/login') || pathname.startsWith('/signup');
  return (
    <AuthProvider>
      <InstallAppPrompt />
      {reading ? (
        children
      ) : (
        <>
          {signingIn ? <AuthHeader /> : <Header />}
          <main className="wrap page">{children}</main>
          <footer className="foot">
            <div className="foot-inner">
              <div className="foot-brand">
                <Logo size="footer" />
                <p>Books, stories, and a community for readers and writers.</p>
                <div className="foot-social">
                  <span className="foot-heading">Connect with us</span>
                  <SocialLinks compact />
                  <a href="mailto:info@palixia.com">info@palixia.com</a>
                </div>
              </div>
              <div className="foot-column">
                <h2 className="foot-heading">Quick Links</h2>
                <Link href="/">Home</Link>
                <Link href="/discover">Discover</Link>
                <Link href="/community">Community</Link>
                <Link href="/library">My Library</Link>
                <PublishLink className="">Publish on Palixia</PublishLink>
              </div>
              <div className="foot-column">
                <h2 className="foot-heading">Resources</h2>
                <Link href="/about">About Palixia</Link>
                <Link href="/authors">Explore Authors</Link>
                <Link href="/contact">Contact Us</Link>
                <Link href="/community-guidelines">Community Guidelines</Link>
              </div>
              <div className="foot-column">
                <h2 className="foot-heading">Legal</h2>
                <Link href="/terms">Terms of Service</Link>
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/copyright">Copyright Policy</Link>
                <Link href="/cookies">Cookie Policy</Link>
              </div>
            </div>
            <div className="foot-bottom">
              <p className="fine">&copy; {new Date().getFullYear()} Palixia. All rights reserved.</p>
            </div>
          </footer>
          <MobileNav />
        </>
      )}
    </AuthProvider>
  );
}
