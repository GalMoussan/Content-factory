// PM2 Configuration for Content Factory
// Start: npx pm2 start ecosystem.config.cjs
// Logs:  npx pm2 logs content-factory
// Stop:  npx pm2 stop content-factory

module.exports = {
  apps: [
    {
      name: 'content-factory',
      script: 'dist/server/src/index.js',
      node_args: '--experimental-specifier-resolution=node',
      instances: 1,
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      merge_logs: true,
      max_size: '10M',
      retain: 5,
    },
  ],
};
