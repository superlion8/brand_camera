/**
 * IndexedDB 存储工具
 * 用于存储生成的图片和应用状态
 */

const DB_NAME = 'brand_camera_db'
const DB_VERSION = 1

// Store names
export const STORES = {
  IMAGES: 'images',
  GENERATIONS: 'generations',
  FAVORITES: 'favorites',
  COLLECTIONS: 'collections',
  ASSETS: 'assets',
  STATE: 'app_state',
} as const

type StoreName = typeof STORES[keyof typeof STORES]

let db: IDBDatabase | null = null

// Initialize IndexedDB
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => {
      console.error('IndexedDB error:', request.error)
      reject(request.error)
    }
    
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      
      // Images store - for storing base64 images with blob URLs
      if (!database.objectStoreNames.contains(STORES.IMAGES)) {
        const imageStore = database.createObjectStore(STORES.IMAGES, { keyPath: 'id' })
        imageStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      // Generations store
      if (!database.objectStoreNames.contains(STORES.GENERATIONS)) {
        const genStore = database.createObjectStore(STORES.GENERATIONS, { keyPath: 'id' })
        genStore.createIndex('createdAt', 'createdAt', { unique: false })
        genStore.createIndex('type', 'type', { unique: false })
      }
      
      // Favorites store
      if (!database.objectStoreNames.contains(STORES.FAVORITES)) {
        const favStore = database.createObjectStore(STORES.FAVORITES, { keyPath: 'id' })
        favStore.createIndex('generationId', 'generationId', { unique: false })
        favStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      // Collections store
      if (!database.objectStoreNames.contains(STORES.COLLECTIONS)) {
        const collStore = database.createObjectStore(STORES.COLLECTIONS, { keyPath: 'id' })
        collStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      // Assets store (user uploaded)
      if (!database.objectStoreNames.contains(STORES.ASSETS)) {
        const assetStore = database.createObjectStore(STORES.ASSETS, { keyPath: 'id' })
        assetStore.createIndex('type', 'type', { unique: false })
        assetStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      // App state store (for zustand persist)
      if (!database.objectStoreNames.contains(STORES.STATE)) {
        database.createObjectStore(STORES.STATE, { keyPath: 'key' })
      }
    }
  })
}

// Generic CRUD operations
export async function dbPut<T>(storeName: StoreName, data: T): Promise<void> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(data)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function dbGet<T>(storeName: StoreName, key: string): Promise<T | undefined> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export async function dbGetAll<T>(storeName: StoreName): Promise<T[]> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function dbDelete(storeName: StoreName, key: string): Promise<void> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function dbClear(storeName: StoreName): Promise<void> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// Image specific operations
export interface StoredImage {
  id: string
  data: string // base64 data
  mimeType: string
  createdAt: string
}

export async function saveImage(id: string, base64Data: string): Promise<string> {
  const image: StoredImage = {
    id,
    data: base64Data,
    mimeType: base64Data.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
    createdAt: new Date().toISOString(),
  }
  await dbPut(STORES.IMAGES, image)
  return id
}

export async function getImage(id: string): Promise<string | null> {
  const image = await dbGet<StoredImage>(STORES.IMAGES, id)
  return image?.data || null
}

export async function deleteImage(id: string): Promise<void> {
  await dbDelete(STORES.IMAGES, id)
}

// Zustand persist storage adapter for IndexedDB
export const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const data = await dbGet<{ key: string; value: string }>(STORES.STATE, name)
      return data?.value || null
    } catch (error) {
      console.error('Error reading from IndexedDB:', error)
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await dbPut(STORES.STATE, { key: name, value })
    } catch (error) {
      console.error('Error writing to IndexedDB:', error)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await dbDelete(STORES.STATE, name)
    } catch (error) {
      console.error('Error deleting from IndexedDB:', error)
    }
  },
}

