import type { NextConfig } from 'next';

// Server-side destination inside the Docker network. The browser never sees
// or resolves this hostname; it only calls the frontend's own origin.
const internalApiUrl =
  process.env.INTERNAL_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${internalApiUrl}/api/v1/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${internalApiUrl}/socket.io/:path*`,
      },
      {
        source: '/docs/:path*',
        destination: `${internalApiUrl}/docs/:path*`,
      },
      {
        source: '/docs',
        destination: `${internalApiUrl}/docs`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/settings',
        destination: '/settings/channels',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
