module.exports = {
  apps: [
    {
      name: 'kaitorix-scraper',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: __dirname,
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        TMPDIR: '/private/tmp',
      },
    },
    {
      name: 'thumbnail-fetcher',
      script: 'node_modules/.bin/tsx',
      args: 'src/thumbnail-fetcher.ts',
      cwd: __dirname,
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        TMPDIR: '/private/tmp',
      },
    },
  ],
};
