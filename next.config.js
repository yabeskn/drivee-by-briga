/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // CORS headers — hanya untuk domain PWA kita
  async headers() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS || 'https://drivee.briga.id';

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
};

module.exports = nextConfig;
