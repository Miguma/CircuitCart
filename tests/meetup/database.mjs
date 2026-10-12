import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

// Embedded PostgreSQL, not a mirror of the business rules. Only Supabase's
// auth/storage infrastructure and unsupported replication DDL are shimmed.
export async function createTestDatabase() {
  const db = new PGlite();
  const load = async (file) => {
    const sql = (await readFile(file, 'utf8'))
      .replace(/^\uFEFF/, '')
      .replace(/^\\.*$/gm, '')
      .replace(/(?:create|alter) publication supabase_realtime[^;]*;/gi, '')
      // PGlite treats MONTH as a reserved token where hosted PostgreSQL accepts
      // the historical migration's unquoted output alias.
      .replace(/\) month,/g, ') as "month",')
      .replace(/order by month\)/g, 'order by "month")');
    try { await db.exec(sql); }
    catch (error) { await db.close(); throw new Error(`${file}: ${error.message}`, { cause: error }); }
  };
  await load(new URL('../finance/bootstrap.sql', import.meta.url));
  await load(new URL('../../supabase/schema.sql', import.meta.url));
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql')).sort()) {
    await load(new URL(file, directory));
  }
  return db;
}
