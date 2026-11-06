import Link from 'next/link';
import PublishLink from '@/components/PublishLink';

export const metadata = {
  title: 'About Palixia',
  description: 'Meet Palixia, a free reading and publishing platform for independent stories and the people who love them.',
};

export default function About() {
  return (
    <div className="stack narrow">
      <h1 className="h1">About Palixia</h1>

      <section className="stack">
        <h2>Stories deserve to find their readers</h2>
        <p>Palixia is an independent reading and publishing platform built around a simple idea: a good story should have the chance to find its audience, wherever it comes from.</p>
        <p>Palixia was started by Paul Osula, a writer from Benin City, Nigeria. Like many independent writers, he understood that writing a story is only part of the journey. Finding readers, sharing your work and building an audience can be just as challenging.</p>
        <p>Palixia grew from that experience into a place where writers can share their work and readers can discover stories beyond the familiar. Palixia is operated as a registered private limited company in Nigeria.</p>
      </section>

      <section className="stack">
        <h2>A place for independent storytelling</h2>
        <p>We welcome authors and readers from around the world, including voices from Africa and its diaspora. Palixia is not limited to one region, language of origin or type of perspective. We want independent stories to be discovered across borders.</p>
        <p>Readers can discover books, read chapters, save stories, follow authors and take part in community conversations. Writers can publish their work for free, create an author presence and connect with readers.</p>
      </section>

      <section className="stack">
        <h2>What matters to us</h2>
        <ul>
          <li><strong>Access:</strong> Reading on Palixia is free.</li>
          <li><strong>Opportunity:</strong> Publishing a story on Palixia is free.</li>
          <li><strong>Creator rights:</strong> Authors retain ownership of their original work.</li>
          <li><strong>Discovery:</strong> We want readers to encounter fresh voices and stories from different places.</li>
          <li><strong>Community:</strong> Reading is better when people can share recommendations and thoughtful conversations.</li>
        </ul>
      </section>

      <section className="stack">
        <h2>Still growing, with readers and writers</h2>
        <p>Palixia is an evolving platform. Features may change as we learn from the people who use it, but our aim remains the same: make it easier to share independent stories and find something worth reading.</p>
        <p>Whether you are here to discover a new author, find your next read, join a conversation or publish a story of your own, you are welcome.</p>
        <p><strong>Every story deserves a reader. Yours included.</strong></p>
        <div className="row">
          <Link className="btn" href="/discover">Explore stories</Link>
          <PublishLink className="btn ghost">Publish your story</PublishLink>
        </div>
      </section>
    </div>
  );
}
