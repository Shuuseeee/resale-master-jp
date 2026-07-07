const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
    ],
  },

  // -- Workbox: InjectManifest via webpack hook (production only) --
  webpack: (config, { dev, isServer }) => {
    // Only inject the SW plugin in production client builds
    if (dev || isServer) return config

    const { InjectManifest } = require('workbox-webpack-plugin')

    config.plugins.push(
      new InjectManifest({
        swSrc: path.resolve(__dirname, 'lib/sw/sw-source.ts'),
        swDest: path.resolve(__dirname, 'public/sw.js'),
        // Exclude hot-update and dev-only files from precache manifest
        exclude: [
          /\.hot-update\.(js|json)$/,
          /\.map$/,
          /sw-source\.ts$/,
        ],
        // Content-hashed _next/static URLs must not be cache-busted
        dontCacheBustURLsMatching: /^\/_next\/static\/.*\.[0-9a-f]{16,}\./,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      })
    )

    return config
  },

  // -- Headers: ensure browsers revalidate sw.js on every load --
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

module.exports = nextConfig