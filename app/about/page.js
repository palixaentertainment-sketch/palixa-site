import Link from 'next/link';
import PublishLink from '@/components/PublishLink';

export const metadata = { title: 'About' };

export default function About() {
  return (
    <div className="stack narrow">
      <h1 className="h1">About Palixia</h1>
      <p>Palixia is a place to read and publish books and comics. Authors publish books and comics directly. Readers discover them, read on their phones, and follow the writers they love.</p>
      <div className="row">
        <Link className="btn" href="/discover">Start Reading</Link>
        <PublishLink className="btn ghost">Publish Your Story</PublishLink>
      </div>
    </div>
  );
}
