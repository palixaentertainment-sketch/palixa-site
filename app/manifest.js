// App identity when Palixia is added to a phone's home screen.
export default function manifest() {
  return {
    name: 'Palixia',
    short_name: 'Palixia',
    description: 'Read and publish books and comics on Palixia.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
