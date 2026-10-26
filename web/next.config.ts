import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser test builds into its own directory so it never clobbers a dev or prod build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
