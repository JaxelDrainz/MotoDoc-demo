import { resolve, join } from 'node:path';

// Keep live local data outside a potentially synced source-code folder on Windows.
export const dataRoot = process.env.MOTODOC_DATA_DIR || (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA,'MotoDoc','data') : resolve('data'));
export const databasePath = resolve(process.env.DATABASE_PATH || join(dataRoot,'motodoc.sqlite'));
export const outboxPath = resolve(process.env.MAILBOX_PATH || join(dataRoot,'mailbox'));
