import mysql from 'mysql2/promise';
import { pool } from '../config/database';

export interface QueryResult {
  insertId?: number;
  affectedRows?: number;
  changedRows?: number;
}

export class DatabaseHelper {
  // Generic query execution
  static async execute<T = any>(
    query: string,
    params: any[] = []
  ): Promise<{ results: T[]; fields?: any[] }> {
    try {
      const [results, fields] = await pool.execute(query, params);
      return { results: results as T[], fields };
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Single row query
  static async findOne<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T | null> {
    const { results } = await this.execute<T>(query, params);
    return results.length > 0 ? results[0] : null;
  }

  // Multiple rows query
  static async findMany<T = any>(
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    const { results } = await this.execute<T>(query, params);
    return results;
  }

  // Insert operation
  static async insert(
    query: string,
    params: any[] = []
  ): Promise<QueryResult> {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(query, params);
      return result as QueryResult;
    } finally {
      connection.release();
    }
  }

  // Update operation
  static async update(
    query: string,
    params: any[] = []
  ): Promise<QueryResult> {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(query, params);
      return result as QueryResult;
    } finally {
      connection.release();
    }
  }

  // Delete operation
  static async delete(
    query: string,
    params: any[] = []
  ): Promise<QueryResult> {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(query, params);
      return result as QueryResult;
    } finally {
      connection.release();
    }
  }

  // Transaction support
  static async transaction<T>(
    callback: (connection: mysql.Connection) => Promise<T>
  ): Promise<T> {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Count query
  static async count(
    table: string,
    conditions: string = '',
    params: any[] = []
  ): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${table} ${conditions ? `WHERE ${conditions}` : ''}`;
    const result = await this.findOne<{ count: number }>(query, params);
    return result?.count || 0;
  }

  /**
   * Appends ORDER BY … LIMIT … OFFSET …. Uses integer literals for LIMIT/OFFSET (values are sanitized),
   * because some MySQL proxies (e.g. Railway) reject prepared placeholders there (ER_WRONG_ARGUMENTS 1210).
   */
  static getPaginationQuery(
    baseQuery: string,
    page: number = 1,
    limit: number = 10,
    orderBy: string = 'created_at DESC'
  ): { query: string; params: any[] } {
    const pg = Math.max(1, Math.min(Math.floor(Number(page)) || 1, 1_000_000));
    const lim = Math.max(1, Math.min(Math.floor(Number(limit)) || 10, 100_000));
    const offset = Math.min(Math.max(0, (pg - 1) * lim), Number.MAX_SAFE_INTEGER);
    const query = `${baseQuery} ORDER BY ${orderBy} LIMIT ${lim} OFFSET ${offset}`;
    return { query, params: [] };
  }

  // Search helper
  static buildSearchCondition(searchFields: string[], searchTerm: string): string {
    if (!searchTerm || !searchFields.length) return '';

    const conditions = searchFields.map(field => `${field} LIKE ?`);
    return `(${conditions.join(' OR ')})`;
  }

  static getSearchParams(searchFields: string[], searchTerm: string): any[] {
    if (!searchTerm || !searchFields.length) return [];
    return searchFields.map(() => `%${searchTerm}%`);
  }
}

export default DatabaseHelper;