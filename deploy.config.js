module.exports = {
  // Configuration du déploiement
  vps: {
    host: process.env.VPS_HOST || 'your-vps-ip',
    user: process.env.VPS_USER || 'root',
    keyPath: process.env.VPS_KEY_PATH || './id_rsa',
  },

  docker: {
    imageName: 'shopify-logistics-app',
    containerName: 'shopify-logistics-app',
    port: 3000,
  },

  app: {
    healthCheckPath: '/api/health',
    healthCheckTimeout: 30000, // 30 seconds
    maxRetries: 3,
  },

  // Branches configuration
  branches: {
    main: {
      environment: 'production',
      dockerTag: 'latest',
    },
    dev: {
      environment: 'staging',
      dockerTag: 'dev',
    },
  },
};