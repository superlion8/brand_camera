import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'Social Media Photos - AI Content Creation | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'Social Media',
    subtitle: 'Create Instagram & Xiaohongshu-ready content with AI',
    emoji: '📱',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  })
}
