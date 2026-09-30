/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Compiler optimizations
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },

  // CORS headers — hanya untuk domain PWA kita
  async headers() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS || 'https://drifee.briga.id';

    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigins },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },

  // Webpack bundle splitting optimization
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = config.optimization || {};
      config.optimization.splitChunks = config.optimization.splitChunks || {};
      config.optimization.splitChunks.cacheGroups = {
        ...(config.optimization.splitChunks.cacheGroups || {}),
        leaflet: {
          test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
          name: 'leaflet-vendor',
          chunks: 'all',
          priority: 40,
        },
        supabase: {
          test: /[\\/]node_modules[\\/](@supabase)[\\/]/,
          name: 'supabase-vendor',
          chunks: 'all',
          priority: 30,
        },
        dexie: {
          test: /[\\/]node_modules[\\/](dexie|dexie-react-hooks)[\\/]/,
          name: 'dexie-vendor',
          chunks: 'all',
          priority: 25,
        },
      };
    }
    return config;
  },
};

module.exports = nextConfig;
