import type { NextConfig } from "next";

// Webflow Cloud injects BASE_URL (the app's mount path, e.g. "/demos/template")
// and ASSETS_PREFIX at build time. Locally these are unset and the app serves
// from "/". Client code reads NEXT_PUBLIC_BASE_PATH via lib/utils withBase().
const basePath = process.env.BASE_URL ?? "";

const nextConfig: NextConfig = {
  ...(basePath
    ? { basePath, assetPrefix: process.env.ASSETS_PREFIX || basePath }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
