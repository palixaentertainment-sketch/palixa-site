'use client';

const SOCIALS = [
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@startxwyh0q?_r=1&_t=ZS-9AQroHHFCYm',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.6 7.1a6.8 6.8 0 0 1-4.2-1.5v8.1a6.2 6.2 0 1 1-5.4-6.1v3.3a2.9 2.9 0 1 0 2.1 2.8V2.5h3.3c.3 2.3 1.9 4 4.2 4.3v.3Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: 'X',
    href: 'https://x.com/PALIXIANOVEL',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 13.9 4.9 22H1.8l7.3-8.4L1.3 2h6.5l4.5 7.5L18.9 2Zm-1.1 17.8h1.7L6.8 4.1H5L17.8 19.8Z" fill="currentColor" />
      </svg>
    ),
  },
];

export default function SocialLinks({ compact = false }) {
  return (
    <div className={compact ? 'social-links social-links-compact' : 'social-links'} aria-label="Palixia social media">
      {SOCIALS.map((social) => (
        <a
          key={social.name}
          className="social-link"
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={'Follow Palixia on ' + social.name}
          title={'Palixia on ' + social.name}
        >
          {social.icon}
          {!compact && <span>{social.name}</span>}
        </a>
      ))}
    </div>
  );
}
