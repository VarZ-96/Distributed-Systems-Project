import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Runs idempotent PostgreSQL schema creation and RBAC seed data on startup.
 */
export class DatabaseInitializer {
  constructor(database, sqlFilePath = join(__dirname, 'init.sql')) {
    this.database = database;
    this.sqlFilePath = sqlFilePath;
  }

  async initialize({ maxRetries = 10, retryDelayMs = 1500 } = {}) {
    await this.#waitForConnection(maxRetries, retryDelayMs);

    const sql = await readFile(this.sqlFilePath, 'utf-8');
    await this.database.query(sql);
  }

  async #waitForConnection(maxRetries, retryDelayMs) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        await this.database.ping();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          console.warn(
            `[DatabaseInitializer] PostgreSQL not ready (attempt ${attempt}/${maxRetries}). Retrying in ${retryDelayMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }
    throw new Error(
      `Failed to connect to PostgreSQL after ${maxRetries} attempts: ${lastError?.message}`
    );
  }
}
