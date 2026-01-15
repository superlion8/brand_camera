import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'Reference Shot - AI Style Matching | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'Reference Shot',
    subtitle: 'Match any reference image style with AI-powered replication',
    emoji: '🎨',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
  })
}
