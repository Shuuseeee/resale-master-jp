module.exports = {
  apps: [{
    name: 'kaitorix-scraper',
    script: 'node_modules/.bin/tsx',
    args: 'src/index.ts',
    cwd: __dirname,
    restart_delay: 5000,
    max_restarts: 10,
    autorestart: true,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
