import Link from 'next/link';

export const metadata = { title: 'About' };

export default function About() {
  return (
    <div className="stack narrow">
      <h1 className="h1">About Palixa</h1>
      <p>Palixa is a reading platform built for independent African writers. Authors publish books and comics directly. Readers discover them, read on their phones, and follow the writers they love.</p>
      <p>This is an early prototype. Reading, publishing and author profiles work today. Paid books, reviews and author earnings are coming in later versions.</p>
      <div className="row">
        <Link className="btn" href="/discover">Start Reading</Link>
        <Link className="btn ghost" href="/signup?as=author">Publish Your Story</Link>
      </div>
    </div>
  );
}
