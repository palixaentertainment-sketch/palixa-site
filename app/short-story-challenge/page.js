import Link from 'next/link';
import HomepageBannerImage from '@/components/HomepageBannerImage';

export const metadata = {
  title: 'Short Story Challenge 2027',
  description: 'The Palixia Short Story Challenge is coming in January 2027. Open to writers everywhere. More details coming soon.',
};

export default function ShortStoryChallengePage() {
  return (
    <main className="short-story-page">
      <div className="short-story-page-inner">
        <Link href="/" className="short-story-back">← Back to Palixia</Link>

        <HomepageBannerImage />

        <section className="short-story-page-intro">
          <p className="short-story-eyebrow">COMING JANUARY 2027</p>
          <h1>Palixia Short Story Challenge</h1>
          <p className="short-story-tagline">A story. A thousand possibilities.</p>
          <p className="short-story-description">
            A new opportunity for writers to share their imagination, tell original stories
            and reach readers beyond their usual audience.
          </p>
          <div className="short-story-open-note">Open to all writers, everywhere.</div>
        </section>

        <section className="short-story-details">
          <h2>More details are on the way.</h2>
          <p>
            We’re still preparing the challenge. The theme, submission guidelines,
            dates and other details will be announced closer to the launch.
          </p>
          <p>Keep an eye on Palixia for the official announcement.</p>
          <Link href="/discover" className="btn">Explore stories on Palixia</Link>
        </section>
      </div>
    </main>
  );
}
