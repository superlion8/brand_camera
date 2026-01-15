import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'Buyer Show - AI Customer Photos | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'Buyer Show',
    subtitle: 'Create authentic customer-style photos with AI-generated real-life scenes',
    emoji: '🛍️',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
  })
}
