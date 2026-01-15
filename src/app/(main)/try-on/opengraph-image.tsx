import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'Virtual Try-On - AI Fitting Room | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'Virtual Try-On',
    subtitle: 'See how clothes look on any model with AI fitting technology',
    emoji: '👗',
    gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
  })
}
