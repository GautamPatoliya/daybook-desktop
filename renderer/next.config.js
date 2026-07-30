/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  distDir: 'out',
  // Packaged app serves UI over http://127.0.0.1 — absolute /_next paths work.
  // Keep relative assetPrefix only as a safety net for file:// debugging.
  assetPrefix: process.env.ELECTRON_FILE_PROTOCOL === '1' ? './' : undefined,
};

module.exports = nextConfig;
