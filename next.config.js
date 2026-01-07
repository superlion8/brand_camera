// Generate build ID once at config load time
const BUILD_ID = `build-${Date.now()}`

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    // This is needed because we fetch images from various e-commerce sites
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // 禁用图片优化的严格检查
    unoptimized: false,
    dangerouslyAllowSVG: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig

