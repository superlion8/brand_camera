import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'AI Camera - Smart Product Capture | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'AI Camera',
    subtitle: 'Capture and enhance product photos in real-time with AI',
    emoji: '📸',
    gradient: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
  })
}
