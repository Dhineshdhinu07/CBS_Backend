import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export const createDbClient = (db: D1Database) => {
  return drizzle(db, { schema });
}; 