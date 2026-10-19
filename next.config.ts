import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Library guides and the Composio list are read from disk at request time; ship them with every function.
  outputFileTracingIncludes: {
    "/": ["./data/guides/**/*"],
    "/**": ["./data/guides/**/*"],
  },
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
