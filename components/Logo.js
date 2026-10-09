import Link from 'next/link';

// The one place the Palixia logo is rendered. Every screen uses this component, so the file,
// the proportions and the spacing rules are identical everywhere.
//
// Sizes are set by height in globals.css (.logo-header, .logo-auth, .logo-footer). The width
// always follows the file's own proportions, so the logo is never stretched or squashed.
// To change the brand name used in alt text and page titles, edit BRAND_NAME.
export const BRAND_NAME = 'Palixia';

// Width and height of palixa-logo.png. They only reserve space so the page does not jump while
// the image loads; CSS sets the displayed size.
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
