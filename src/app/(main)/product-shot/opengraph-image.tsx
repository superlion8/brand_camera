import { generateOGImage, ogImageSize, ogContentType } from '@/lib/og-image'

export const alt = 'Product Studio - Clean Background Photos | BrandCam'
export const size = ogImageSize
export const contentType = ogContentType

export default async function OGImage() {
  return generateOGImage({
    title: 'Product Studio',
    subtitle: 'Create clean, professional product photos with perfect backgrounds',
    emoji: '✨',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)',
  })
}
