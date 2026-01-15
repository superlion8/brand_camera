import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'AI Photo Editor - Smart Enhancement | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'AI Photo Editor',
    subtitle: 'Enhance, retouch, and transform your photos with AI',
    emoji: '🖼️',
    gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
  })
}
