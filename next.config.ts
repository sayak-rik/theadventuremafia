import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the production Docker image stays small.
  output: "standalone",
  images: {
    remotePatterns: [
      // Allow Unsplash placeholders used for hero/section imagery until real
      // brand photography is supplied.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
