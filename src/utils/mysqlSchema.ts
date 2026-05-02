import DatabaseHelper from './database';

const columnPresence = new Map<string, boolean>();

/**
 * Cached check for optional columns (e.g. after partial deploys where migrations lag).
 */
export async function tableHasColumn(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  if (columnPresence.has(key)) return columnPresence.get(key)!;

  try {
    const row = await DatabaseHelper.findOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    const exists = Boolean(row != null && Number(row.n) > 0);
    columnPresence.set(key, exists);
    return exists;
  } catch (e) {
    console.warn(
      `[mysqlSchema] Could not inspect column ${tableName}.${columnName}; assuming absent.`,
      e
    );
    columnPresence.set(key, false);
    return false;
  }
}
