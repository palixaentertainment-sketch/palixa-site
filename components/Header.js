'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { supabase, configured } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import Logo from '@/components/Logo';
import NotificationsBell from '@/components/NotificationsBell';
import ThemeToggle from '@/components/ThemeToggle';
import { openInstallApp } from '@/components/InstallAppPrompt';

const LINKS = [
  ['/', 'Home'],
  ['/discover', 'Discover'],
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
  const [fridayAnnouncement, setFridayAnnouncement] = useState(null);
  const isAuthor = profile && (profile.role === 'author' || profile.role === 'admin');
  const isAdmin = profile && profile.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    async function loadFridayAnnouncement() {
      if (!configured) return;
      const now = new Date().toISOString();
      const { data } = await supabase.from('palixia_friday_hunts')
        .select('id,title,starts_at,ends_at,status')
        .eq('status', 'published')
        .gte('ends_at', now)
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setFridayAnnouncement(data || null);
    }
    loadFridayAnnouncement();
    return () => { cancelled = true; };
  }, [pathname]);

  function search(e) {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? '/discover?q=' + encodeURIComponent(t) : '/discover');
  }

  const huntStarts = fridayAnnouncement ? new Date(fridayAnnouncement.starts_at).getTime() : 0;
  const huntUpcoming = fridayAnnouncement && Date.now() < huntStarts;

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
          <button type="button" className="get-app-trigger get-app-desktop" onClick={openInstallApp} aria-label="Get the Palixia app">↓ Get the App</button>
          <form className="hsearch" onSubmit={search} role="search">
            <label className="sr-only" htmlFor="hq">Search books, authors or genres</label>
            <input id="hq" type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" aria-label="Search">Go</button>
          </form>
          <ThemeToggle />
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
              <Link className="authlinks linkbtn" href="/offline">Offline books</Link>
              {isAuthor && <Link className="authlinks linkbtn" href="/dashboard">Dashboard</Link>}
              {isAdmin && <Link className="authlinks linkbtn" href="/admin">Admin</Link>}
              <details className="menu" key={pathname}>
                <summary aria-label="Account menu"><Avatar src={profile && profile.avatar_url} name={profile ? profile.name : '?'} size="2.2rem" /></summary>
                <div className="pop">
                  <div className="who"><b>{profile ? profile.name : 'Your account'}</b><span className="fine">{profile ? '@' + profile.username : ''}</span></div>
                  <Link href="/profile">Profile</Link>
                  <Link href="/library">Library</Link>
                  <Link href="/offline">My Books · Offline</Link>
                  {isAuthor ? <Link href="/dashboard">Author dashboard</Link> : <Link href="/profile#author">Become an author</Link>}
                  {isAdmin && <Link href="/admin">Admin dashboard</Link>}
                  {isAdmin && <Link href="/admin/fridays">Manage Palixia Fridays</Link>}
                  <button type="button" onClick={signOut}>Sign out</button>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
      {fridayAnnouncement && (
        <div className="fridays-site-announcement">
          <span className="fridays-announcement-mark" aria-hidden="true">✦</span>
          <span><b>{huntUpcoming ? 'Coming up on Palixia Fridays:' : 'Palixia Fridays is live:'}</b> {fridayAnnouncement.title}</span>
          <Link href="/fridays">{huntUpcoming ? 'Get ready' : 'Join the hunt'} <span aria-hidden="true">→</span></Link>
        </div>
      )}
    </header>
  );
}
