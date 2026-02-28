import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
