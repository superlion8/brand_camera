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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cvdogeigbpussfamctsu.supabase.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
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

