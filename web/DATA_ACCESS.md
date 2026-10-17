# Database read rule

All user-triggered, read-only database requests must reuse data that has already
been loaded during the current application session.

- Data loaded by `DataContext` is read from context state by views and dialogs.
- Lazy database reads use `readDatabaseOnce` from
  `src/lib/database-read-cache.ts`.
- Concurrent requests for the same key share one database request.
- Only successful results are cached; errors can be retried.
- A mutation invalidates the affected cache key before another read.
- An explicit refresh bypasses and invalidates the related cache.

Do not add a direct repeated `select` for data that is already present in context
state or in the read-through cache.
