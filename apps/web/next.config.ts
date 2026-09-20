import type { NextConfig } from "next";

const apiOrigin =
  process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  distDir: process.env.GEO_NEXT_DIST_DIR || ".next",
  transpilePackages: ["@geo/contracts"],
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
