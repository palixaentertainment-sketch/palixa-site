'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export default function MobileNav() {
  const pathname = usePathname() || '/';
  const { user } = useAuth();
  const items = [
    { href: '/', label: 'Home', match: (p) => p === '/', icon: <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
    { href: '/discover', label: 'Discover', match: (p) => p.startsWith('/discover') || p.startsWith('/book') || p.startsWith('/categories') || p.startsWith('/authors') || p.startsWith('/author/'), icon: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></> },
    { href: '/community', label: 'Community', match: (p) => p.startsWith('/community'), icon: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></> },
    { href: '/library', label: 'Library', match: (p) => p.startsWith('/library'), icon: <><path d="M5 4h4v16H5z" /><path d="M11 4h4v16h-4z" /><path d="M17.5 5l3 .8-3.7 14.5-3-.8z" /></> },
    { href: user ? '/profile' : '/login', label: 'Profile', match: (p) => p.startsWith('/profile') || p.startsWith('/dashboard') || p.startsWith('/login') || p.startsWith('/signup'), icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
  ];
  return (
    <nav className="bottomnav" aria-label="Main">
      <div className="wrap">
        {items.map((it) => (
          <Link key={it.label} href={it.href} className="bn" aria-current={it.match(pathname) ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" {...ICON}>{it.icon}</svg>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
