import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@libsql/client/web';
import { migrations, schemaSql } from './database.js';

export async function openRemoteDatabase({
  url = process.env.TURSO_DATABASE_URL,
  authToken = process.env.TURSO_AUTH_TOKEN,
} = {}) {
  if (!url || (!authToken && !url.startsWith('file:')))
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for hosted persistence.');
  const clientFactory = url.startsWith('file:')
    ? (await import('@libsql/client')).createClient
    : createClient;
  const client = clientFactory({ url, authToken });
  await client.executeMultiple(schemaSql);
  const columns = (await client.execute('PRAGMA table_info(users)')).rows;
  if (!columns.some((column) => column.name === 'google_id')) {
    try {
      await client.execute('ALTER TABLE users ADD COLUMN google_id TEXT');
    } catch (error) {
      if (!/duplicate column name/i.test(error.message)) throw error;
    }
  }
  await client.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL',
  );
  for (const [version, statements] of migrations)
    if (
      !(
        await client.execute({
          sql: 'SELECT 1 FROM schema_versions WHERE version=?',
          args: [version],
        })
      ).rows.length
    )
      await client.batch(
        [
          ...statements,
          { sql: 'INSERT OR IGNORE INTO schema_versions(version) VALUES(?)', args: [version] },
        ],
        'write',
      );
  const context = new AsyncLocalStorage();
  const execute = (sql, params) => (context.getStore() || client).execute({ sql, args: params });
  return {
    prepare(sql) {
      return {
        async get(...params) {
          return (await execute(sql, params)).rows[0];
        },
        async all(...params) {
          return (await execute(sql, params)).rows;
        },
        async run(...params) {
          const result = await execute(sql, params);
          return { changes: result.rowsAffected };
        },
      };
    },
    async withTransaction(fn) {
      const tx = await client.transaction('write');
      return context.run(tx, async () => {
        try {
          const result = await fn();
          await tx.commit();
          return result;
        } catch (error) {
          await tx.rollback();
          throw error;
        } finally {
          await tx.close();
        }
      });
    },
    close() {
      return client.close();
    },
  };
}
