import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * Navigate to the general edit page with an image
 * 
 * @param router - Next.js router instance
 * @param imageUrl - The image URL to edit
 * 
 * @example
 * navigateToEdit(router, resultImages[0])
 */
export function navigateToEdit(router: AppRouterInstance, imageUrl: string): void {
  sessionStorage.setItem('editImage', imageUrl)
  router.push('/edit/general')
}

/**
 * Navigate to try-on page with an image
 * 
 * @param router - Next.js router instance
 * @param imageUrl - The image URL to use for try-on
 */
export function navigateToTryOn(router: AppRouterInstance, imageUrl: string): void {
  sessionStorage.setItem('tryOnImage', imageUrl)
  router.push('/try-on')
}

/**
 * Navigate to group-shot page with an image
 * 
 * @param router - Next.js router instance
 * @param imageUrl - The image URL to use for group shot
 */
export function navigateToGroupShot(router: AppRouterInstance, imageUrl: string): void {
  sessionStorage.setItem('groupShotImage', imageUrl)
  router.push('/group-shot')
}

/**
 * Navigate to modify-material page with an image
 * 
 * @param router - Next.js router instance
 * @param imageUrl - The image URL to modify material
 */
export function navigateToModifyMaterial(router: AppRouterInstance, imageUrl: string): void {
  sessionStorage.setItem('modifyMaterialImage', imageUrl)
  router.push('/gallery/modify-material')
}
