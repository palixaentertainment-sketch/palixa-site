import Link from 'next/link';

export const metadata = {
  title: 'Development Roadmap',
  description: 'See what Palixia has improved, what we are focusing on now, and what we are exploring for the future.',
};

const groups = [
  {
    eyebrow: 'Recently improved',
    title: 'A stronger foundation',
    intro: 'Updates already introduced to make reading, writing and taking part in the community more useful.',
    items: [
      ['For readers', 'Personal libraries, bookmarks, reading progress and history, plus Want to Read, Reading Now and Finished shelves.'],
      ['Reading experience', 'Adjustable line spacing, author following, book comments, replies and likes.'],
      ['Discoverability', 'A Discover page with filters to help readers find stories.'],
      ['For writers', 'A richer chapter editor with bold, italics, headings, lists and blockquotes.'],
      ['Writing space', 'A more open writing area with draft autosave, preview and word-count tools.'],
      ['Community', 'Community posts, discussions, Book Polls, announcements and Creator of the Week.'],
    ],
  },
  {
    eyebrow: 'Current priorities',
    title: 'What we are focusing on',
    intro: 'These are the areas guiding our ongoing work. The order and scope may change as we learn from the people using Palixia.',
    items: [
      ['A better mobile website', 'Continue improving the experience of reading, discovering and publishing on a phone.'],
      ['Reader growth and retention', 'Reach new readers and give existing readers more reasons to discover stories and return.'],
      ['Author and book visibility', 'Make author spotlights, featured stories and promotional opportunities more consistent and useful.'],
      ['Community engagement', 'Develop activities and conversations that bring readers and writers together.'],
    ],
  },
  {
    eyebrow: 'Looking ahead',
    title: 'Ideas we are exploring',
    intro: 'These are longer-term possibilities, not confirmed release commitments. We will share more as plans become clearer.',
    items: [
      ['Palixia Spark', 'Our planned reader-to-author support feature, giving readers another way to show appreciation for writers.'],
      ['A dedicated mobile app', 'Exploring what it would take to bring Palixia to Android and iOS in the future.'],
      ['More ways to discover stories', 'Further improvements to recommendations, author promotion and the path from finding a book to reading it.'],
    ],
  },
];

export default function DevelopmentRoadmapPage() {
  return (
    <div className="roadmap stack">
      <section className="roadmap-hero">
        <p className="mono">BUILDING PALIXIA, TOGETHER</p>
        <h1 className="h1">The Palixia Development Roadmap</h1>
        <p className="roadmap-lead">A look at what we have improved, what we are working to make better, and what we are exploring for the future.</p>
        <p className="roadmap-note">Palixia is growing with its readers and writers. This page is here to make our direction more visible—not to promise dates we cannot guarantee.</p>
      </section>

      {groups.map((group, index) => (
        <section className="roadmap-section" key={group.title}>
          <div className="roadmap-section-head">
            <span className="roadmap-number">0{index + 1}</span>
            <div>
              <p className="mono">{group.eyebrow}</p>
              <h2 className="h2">{group.title}</h2>
              <p className="muted">{group.intro}</p>
            </div>
          </div>
          <div className="roadmap-grid">
            {group.items.map(([title, description]) => (
              <article className="roadmap-card" key={title}>
                <span className="roadmap-card-mark" aria-hidden="true">✦</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="roadmap-feedback">
        <p className="mono">YOUR VOICE MATTERS</p>
        <h2 className="h2">Help shape what comes next.</h2>
        <p>Have an idea, noticed something that could work better, or want to tell us what would make you come back to read? We want to hear from you.</p>
        <div className="row">
          <Link className="btn" href="/community">Join the conversation</Link>
          <Link className="btn ghost" href="/contact">Send us feedback</Link>
        </div>
      </section>

      <p className="roadmap-footnote">This roadmap reflects our current direction and may change as priorities, resources and community feedback evolve. We will update it as meaningful progress is made.</p>
    </div>
  );
}
