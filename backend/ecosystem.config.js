module.exports = {
  apps: [
    {
      name: 'aura-backend',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: process.env.WEB_CONCURRENCY || 'max',
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '650M',
      kill_timeout: 10000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
