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

  // -- Redirects: 已并入其它页面的旧地址（收藏 / PWA 历史记录里可能还指向它们）--
  async redirects() {
    return [
      // 支付方式已并入设置页的一个区块（2026-10-09）；:path* 同时覆盖旧的 add、[id]/edit
      { source: '/settings/payment-methods/:path*', destination: '/settings#payment-methods', permanent: false },
    ]
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