import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lrgwsbslfqiwoazmitre.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ments-public.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.ments.app',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
    // Enable modern image formats
    formats: ['image/avif', 'image/webp'],
    // Optimize for 1-year cache TTL (31536000 seconds)
    minimumCacheTTL: 31536000,
    // Optimize device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Image optimization is enabled (unoptimized was removed to allow
    // Next.js to serve images in modern formats at proper device sizes)
  },
  async headers() {
    return [
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/api/posts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/environments',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=60',
          },
        ],
      },
      {
        source: '/api/events',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=120, stale-while-revalidate=60',
          },
        ],
      },
      {
        source: '/api/resources',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=120, stale-while-revalidate=60',
          },
        ],
      },
      {
        source: '/api/competitions',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=120, stale-while-revalidate=60',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
