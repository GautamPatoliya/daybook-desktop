/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // Keep default `.next` for `next dev` / build cache.
  // Static export still lands in `out/` - do not set distDir to `out` or
  // `next dev` overwrites the packaged UI and Electron serves a 404.
  // Packaged app serves UI over http://127.0.0.1 - absolute /_next paths work.
  // Keep relative assetPrefix only as a safety net for file:// debugging.
  assetPrefix: process.env.ELECTRON_FILE_PROTOCOL === '1' ? './' : undefined,
};

module.exports = nextConfig;
