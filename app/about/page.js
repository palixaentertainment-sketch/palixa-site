import Link from 'next/link';
import PublishLink from '@/components/PublishLink';


export const metadata = {
  title: 'About Palixia',
  description: 'Palixia brings independent writers and readers together to discover, share and enjoy original stories.',
};

export default function About() {
  return (
    <div className="stack narrow">
      <h1 className="h1">About Palixia</h1>

      <section className="stack">
        <h2>Where stories meet readers</h2>
        <p>My name is Paul Osula. I’m a writer from Benin City, Nigeria, and the person behind Palixia.</p>
        <p>Writing a book takes imagination, patience, and a lot of work. But finding readers can be just as difficult, especially for writers building their audience independently.</p>
        <p>I started Palixia to make that journey a little easier: a place where writers can share their work and readers can discover stories beyond the familiar.</p>
      </section>

      <section className="stack">
        <h2>What Palixia is about</h2>
        <p>Palixia is an independent reading and publishing platform built to bring authors and readers closer together.</p>
        <p>We welcome stories from around the world, including voices from Africa and its diaspora. A great story should have the chance to find its audience wherever it comes from.</p>
        <p>Readers can explore books, follow authors, join conversations and connect through a shared love of reading. Writers can publish their work for free and build an audience of their own.</p>
      </section>

      <section className="stack">
        <h2>What we are building</h2>
        <p>We want Palixia to be a welcoming home for independent storytelling: open to new voices, different perspectives and readers with curious minds.</p>
        <p>From discovering your next favourite book to sharing your own work, our aim is to make reading and publishing feel connected rather than separate.</p>
        <p>Palixia is still growing, and the community will help shape what it becomes.</p>
      </section>

      <section className="stack">
        <h2>There is a place for you here</h2>
        <p>Come to discover a new author, find your next read, meet fellow book lovers, or publish a story of your own. Reading is free, and publishing is free too.</p>
        <p><strong>Every story deserves a reader. Yours included.</strong></p>
        <div className="row">
          <Link className="btn" href="/discover">Explore stories</Link>
          <PublishLink className="btn ghost">Publish your story</PublishLink>
        </div>
      </section>
    </div>
  );
}
