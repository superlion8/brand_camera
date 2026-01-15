import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'Lifestyle Shots - AI Scene Generation | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'Lifestyle Shots',
    subtitle: 'Generate stunning lifestyle scenes with AI-matched models and backgrounds',
    emoji: '🌆',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  })
}
