'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

// Wraps a page that needs a signed-in person, and optionally a particular role.
// The database enforces the same rules, so this is for a good experience, not for security.
export default function Guard({ roles, children }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=' + encodeURIComponent(pathname || '/'));
  }, [loading, user, router, pathname]);

  if (loading || !user) return <p className="muted">Loading...</p>;
  if (!profile) {
    return <p className="notice">We could not load your account. Refresh the page, or sign out and back in.</p>;
  }
  if (profile.status === 'suspended') {
    return <p className="notice">This account has been suspended. Contact Palixa support if you think this is a mistake.</p>;
  }
  if (roles && !roles.includes(profile.role)) {
    return (
      <div className="empty">
        <div>
          <b>This area is for authors.</b>
          <p>Switch your account to an author account to publish books and comics.</p>
        </div>
        <Link className="btn" href="/profile#author">Become an author</Link>
      </div>
    );
  }
  return children;
}
