// Generate build ID once at config load time
const BUILD_ID = `build-${Date.now()}`

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SEO: 统一 URL 格式，不带尾部斜杠
  trailingSlash: false,
  // Generate unique build ID to bust cache on each deploy
  generateBuildId: async () => {
    return BUILD_ID
  },
  // Expose build ID to server-side code
  env: {
    NEXT_BUILD_ID: BUILD_ID,
  },
  images: {
    // Allow all external images for brand style analysis
    // Disable optimization for external images (Instagram, Shopify CDN, etc.)
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    dangerouslyAllowSVG: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig

