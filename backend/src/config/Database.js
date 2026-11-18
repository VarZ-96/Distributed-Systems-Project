import pg from 'pg';

const { Pool } = pg;

/**
 * Singleton PostgreSQL connection pool wrapper.
 * Provides parameterized queries, ACID transaction management, and health checks.
 */
export class Database {
  static #instance = null;

  constructor(connectionString) {
    if (!connectionString) {
      throw new Error('Database requires a valid connectionString');
    }

    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (err) => {
      console.error('[Database] Unexpected idle PostgreSQL client error:', err.message);
    });
  }

  static getInstance(connectionString) {
    if (!Database.#instance) {
      Database.#instance = new Database(connectionString);
    }
    return Database.#instance;
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }

  async ping() {
    await this.pool.query('SELECT 1');
    return true;
  }

  /**
   * Executes a callback inside an ACID PostgreSQL transaction.
   * Automatically commits on success and rolls back on any thrown error.
   */
  async withTransaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
    if (Database.#instance === this) {
      Database.#instance = null;
    }
  }
}
