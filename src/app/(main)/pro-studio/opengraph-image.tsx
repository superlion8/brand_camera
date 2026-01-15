import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'Pro Studio - AI Model Photography | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'Pro Studio',
    subtitle: 'Professional AI model photography with studio-quality backgrounds',
    emoji: '🎬',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  })
}
