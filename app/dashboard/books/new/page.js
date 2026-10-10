'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';
import BookForm from '@/components/BookForm';

function NewBook() {
  const { user } = useAuth();
  const router = useRouter();
  return (
    <div className="stack narrow">
      <Link className="linkbtn" href="/dashboard">&larr; Dashboard</Link>
      <h1 className="h1">Create New Work</h1>
      <p className="muted">Choose a format, fill in the details, then add chapters or write a poem. Drafts are only visible to you until you publish.</p>
      <BookForm userId={user.id} book={null} onSaved={(id) => router.push('/dashboard/books/' + id)} />
    </div>
  );
}

export default function NewBookPage() {
  return <Guard roles={['author', 'admin']}><NewBook /></Guard>;
}
