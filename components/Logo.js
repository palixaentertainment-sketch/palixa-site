import Link from 'next/link';

// One shared component keeps the logo consistent across the site.
export const BRAND_NAME = 'Palixia';

const FILE_WIDTH = 480;
const FILE_HEIGHT = 239;

export default function Logo({ size = 'header', href = '/' }) {
  const filterId = 'palixia-logo-remove-white-' + size;
  const image = (
    <>
      {/* The source PNG has a white matte. This filter makes near-white pixels transparent
          while retaining the purple mark and the pale-pink dot, so the logo sits cleanly
          on both light and dark surfaces without inverting the brand colours. */}
      <svg aria-hidden="true" width="0" height="0" focusable="false" className="logo-filter-defs">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1.4882 -5.0064 -0.5054 0 7"
            />
          </filter>
        </defs>
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={'logo-img logo-' + size}
        src="/brand/palixa-logo.png"
        width={FILE_WIDTH}
        height={FILE_HEIGHT}
        alt={href ? '' : BRAND_NAME}
        decoding="async"
        style={{ filter: 'url(#' + filterId + ')' }}
      />
    </>
  );
  if (!href) return image;
  return (
    <Link href={href} className="logo-link" aria-label={BRAND_NAME + ' home'}>
      {image}
    </Link>
  );
}
