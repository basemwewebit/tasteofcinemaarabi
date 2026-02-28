import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com;",
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.tasteofcinema.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "tasteofcinema.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
