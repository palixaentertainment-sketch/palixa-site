'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

// Where a "Publish" button should go for the person looking at it.
// Signed out: create an author account. Author: start a new book. Reader: switch to an author account.
export function usePublishHref() {
  const { user, profile } = useAuth();
  if (!user) return '/signup?as=author';
  if (profile && (profile.role === 'author' || profile.role === 'admin')) return '/dashboard/books/new';
  return '/profile#author';
}

export default function PublishLink({ className = 'btn', children }) {
  const href = usePublishHref();
  return <Link className={className} href={href}>{children}</Link>;
}
