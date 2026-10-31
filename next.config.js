/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Palixia book covers and uploaded profile images live in Supabase Storage.
    // Next.js creates correctly-sized AVIF/WebP variants and caches them.
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200],
    imageSizes: [64, 96, 128, 160, 192, 256, 320],
  },
};

module.exports = nextConfig;
