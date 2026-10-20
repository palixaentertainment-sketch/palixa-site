import Link from 'next/link';

export const BRAND_NAME = 'Palixia';

export default function Logo({ size = 'header', href = '/' }) {
  const image = (
    <img
      className={'logo-img logo-' + size}
      src="/icon.svg"
      alt={href ? '' : BRAND_NAME}
      aria-hidden={href ? 'true' : undefined}
      width="48"
      height="48"
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
  if (!href) return image;
  return (
    <Link href={href} className="logo-link" aria-label={BRAND_NAME + ' home'}>
      {image}
    </Link>
  );
}
