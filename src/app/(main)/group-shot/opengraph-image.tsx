import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'Group Shot - Multi-Angle AI Photos | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'Group Shot',
    subtitle: 'Generate multi-angle product photos in one batch',
    emoji: '📷',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  })
}
