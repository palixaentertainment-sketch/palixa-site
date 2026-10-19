import Link from 'next/link';

// The original raster logo has a white matte baked into the PNG.
// Render it inside SVG so the matte can be removed reliably before theme styling.
export const BRAND_NAME = 'Palixia';

const FILE_WIDTH = 480;
const FILE_HEIGHT = 239;

export default function Logo({ size = 'header', href = '/' }) {
  const image = (
    <svg
      className={'logo-img logo-' + size}
      viewBox={`0 0 ${FILE_WIDTH} ${FILE_HEIGHT}`}
      role={href ? undefined : 'img'}
      aria-label={href ? undefined : BRAND_NAME}
      aria-hidden={href ? 'true' : undefined}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="palixia-logo-transparent-matte" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    -1 -1 -1 0 2.95"
          />
        </filter>
      </defs>
      <image
        href="/brand/palixa-logo.png"
        width={FILE_WIDTH}
        height={FILE_HEIGHT}
        preserveAspectRatio="none"
        filter="url(#palixia-logo-transparent-matte)"
      />
    </svg>
  );
  if (!href) return image;
  return (
    <Link href={href} className="logo-link" aria-label={BRAND_NAME + ' home'}>
      {image}
    </Link>
  );
}
