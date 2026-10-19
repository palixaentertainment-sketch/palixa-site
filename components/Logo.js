import Link from 'next/link';

// One shared component keeps the logo consistent across the site.
export const BRAND_NAME = 'Palixia';

const FILE_WIDTH = 480;
const FILE_HEIGHT = 239;

export default function Logo({ size = 'header', href = '/' }) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={'logo-img logo-' + size}
      src="/brand/palixa-logo.png"
      width={FILE_WIDTH}
      height={FILE_HEIGHT}
      alt={href ? '' : BRAND_NAME}
      decoding="async"
    />
  );
  if (!href) return image;
  return (
    <Link href={href} className="logo-link" aria-label={BRAND_NAME + ' home'}>
      {image}
    </Link>
  );
}
