'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Avatar from '@/components/Avatar';
import Logo from '@/components/Logo';
import NotificationsBell from '@/components/NotificationsBell';

const LINKS = [
  ['/', 'Home'],
  ['/discover', 'Discover'],
  ['/discover?type=poem', 'Poetry']
  ['/community', 'Community'],
  ['/categories', 'Categories'],
  ['/authors', 'Authors'],
  ['/about', 'About'],
];

export default function Header() {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [q, setQ] = useState('');
  const isAuthor = profile && (profile.role === 'author' || profile.role === 'admin');
  const isAdmin = profile && profile.role === 'admin';

  function search(e) {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? '/discover?q=' + encodeURIComponent(t) : '/discover');
  }

  return (
    <header className="top">
      <div className="wrap">
        <Logo size="header" />
        <nav className="navlinks" aria-label="Main">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={(href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        <div className="topright">
          <form className="hsearch" onSubmit={search} role="search">
            <label className="sr-only" htmlFor="hq">Search books, authors or genres</label>
            <input id="hq" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" aria-label="Search">Go</button>
          </form>
          {!loading && !user && (
            <div className="guestlinks">
              <Link className="btn ghost small" href="/login">Log in</Link>
              <Link className="btn small" href="/signup">Sign up</Link>
            </div>
          )}
          {!loading && user && (
            <>
              <NotificationsBell user={user} />
              <Link className="authlinks linkbtn" href="/library">Library</Link>
              {isAuthor && <Link className="authlinks linkbtn" href="/dashboard">Dashboard</Link>}
              {isAdmin && <Link className="authlinks linkbtn" href="/admin">Admin</Link>}
              <details className="menu" key={pathname}>
                <summary aria-label="Account menu"><Avatar src={profile && profile.avatar_url} name={profile ? profile.name : '?'} size="2.2rem" /></summary>
                <div className="pop">
                  <div className="who"><b>{profile ? profile.name : 'Your account'}</b><span className="fine">{profile ? '@' + profile.username : ''}</span></div>
                  <Link href="/profile">Profile</Link>
                  <Link href="/library">Library</Link>
                  {isAuthor ? <Link href="/dashboard">Author dashboard</Link> : <Link href="/profile#author">Become an author</Link>}
                  {isAdmin && <Link href="/admin">Admin dashboard</Link>}
                  <button type="button" onClick={signOut}>Sign out</button>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
