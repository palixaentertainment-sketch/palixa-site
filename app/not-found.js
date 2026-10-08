import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty">
      <div>
        <b>We could not find that page.</b>
        <p>The link may be old, or the story may have been unpublished.</p>
      </div>
      <Link className="btn" href="/discover">Discover stories</Link>
    </div>
  );
}
