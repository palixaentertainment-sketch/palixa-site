import Link from 'next/link';
import PublishLink from '@/components/PublishLink';

export const metadata = {
  title: 'About Palixia',
  description: 'Meet Palixia and learn why we are building a place for independent writers, books, comics, and readers.',
};

export default function About() {
  return (
    <div className="stack narrow">
      <h1 className="h1">About Palixia</h1>

      <section className="stack">
        <h2>A little about us</h2>
        <p>My name is Paul Osula. I’m a writer from Benin City, Nigeria, and the person behind Palixia.</p>
        <p>As a writer, I understand how much goes into creating a story. Every book begins with an idea, but turning that idea into something people can read and enjoy takes time, creativity, and dedication.</p>
        <p>I wanted to help create a space where stories could find their readers and writers could share their work with the world.</p>
      </section>

      <section className="stack">
        <h2>Why I started Palixia</h2>
        <p>Palixia began with a simple idea: make it easier for independent writers to publish their stories and connect with readers.</p>
        <p>I believe great stories deserve a chance to be discovered, regardless of whether their authors have a traditional publisher behind them.</p>
        <p>That’s why Palixia brings books, comics, authors, and readers together in one place. It’s a platform where creators can share their work and readers can discover stories they might never have found otherwise.</p>
      </section>

      <section className="stack">
        <h2>Our vision</h2>
        <p>Palixia is being built for people who love stories, whether they’re writing them or reading them.</p>
        <p>Our goal is to build a growing community where independent authors can publish their books and comics, readers can discover new favourites, and more stories can find the audiences they deserve.</p>
        <p>We’re just getting started, and there’s still a lot to build.</p>
      </section>

      <section className="stack">
        <h2>Be part of the journey</h2>
        <p>Whether you’re a reader searching for your next favourite book or a writer ready to share your work, there’s a place for you on Palixia.</p>
        <p><strong>Your next favourite story could be waiting here.</strong></p>
        <div className="row">
          <Link className="btn" href="/discover">Discover Stories</Link>
          <PublishLink className="btn ghost">Publish Your Story</PublishLink>
        </div>
      </section>
    </div>
  );
}
