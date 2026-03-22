import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '転売账务管理',
    short_name: '転売管理',
    description: '日本転売業務账务管理システム',
    start_url: '/',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#0d9488',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
