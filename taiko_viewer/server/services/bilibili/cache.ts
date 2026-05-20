type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const dynamicCache = new Map<string, CacheEntry<unknown>>();
const imageCache = new Map<string, CacheEntry<{ data: Buffer; contentType: string }>>();

export const getCachedDynamic = <T>(key: string): T | null => {
  const entry = dynamicCache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAt) {
    dynamicCache.delete(key);
    return null;
  }
  return entry.value as T;
};

export const setCachedDynamic = (key: string, value: unknown, ttlMs: number) => {
  dynamicCache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

export const getCachedImage = (key: string) => {
  const entry = imageCache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAt) {
    imageCache.delete(key);
    return null;
  }
  return entry.value;
};

export const setCachedImage = (key: string, value: { data: Buffer; contentType: string }, ttlMs: number) => {
  imageCache.set(key, { value, expiresAt: Date.now() + ttlMs });
};
