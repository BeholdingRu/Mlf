/**
 * Project data-access rule:
 * - user-triggered, read-only database requests must use this read-through cache;
 * - successful results and in-flight requests are reused during the app session;
 * - failed requests are never cached;
 * - mutations must invalidate the affected key before the data is read again;
 * - an explicit refresh may bypass the cache, but must invalidate related keys.
 */

const cachedResults = new Map<string, unknown>()
const pendingReads = new Map<string, Promise<unknown>>()
const keyVersions = new Map<string, number>()

export const databaseReadKeys = {
  userPrefix: (userId: string) => `user:${userId}:`,
  calorieNormHistory: (userId: string) => `user:${userId}:calorie-norm-history`,
  bibleChapter: (bookOrder: number, chapter: number, includeTorahPortions: boolean) => (
    `bible:chapter:${includeTorahPortions ? 'annual' : 'plain'}:${bookOrder}:${chapter}`
  ),
  torahPortions: (bookOrder: number) => `bible:torah-portions:${bookOrder}`,
}

export function readDatabaseOnce<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (cachedResults.has(key)) {
    return Promise.resolve(cachedResults.get(key) as T)
  }

  const pending = pendingReads.get(key)
  if (pending) return pending as Promise<T>

  const version = keyVersions.get(key) ?? 0
  const request = loader()
    .then((result) => {
      if ((keyVersions.get(key) ?? 0) === version) {
        cachedResults.set(key, result)
      }
      return result
    })
    .finally(() => {
      if (pendingReads.get(key) === request) pendingReads.delete(key)
    })

  pendingReads.set(key, request)
  return request
}

export function getCachedDatabaseRead<T>(key: string): T | undefined {
  return cachedResults.get(key) as T | undefined
}

export function invalidateDatabaseReads(keyPrefix: string) {
  const keys = new Set([...cachedResults.keys(), ...pendingReads.keys()])
  keys.forEach((key) => {
    if (!key.startsWith(keyPrefix)) return
    cachedResults.delete(key)
    pendingReads.delete(key)
    keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1)
  })
}
