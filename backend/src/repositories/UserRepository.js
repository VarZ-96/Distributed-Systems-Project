import { User } from '../models/entities.js';

/**
 * Repository Pattern: encapsulates all SQL queries for the `users` table.
 * Zero SQL leaks into services or controllers.
 */
export class UserRepository {
  constructor(database) {
    this.database = database;
  }

  async findById(id) {
    const { rows } = await this.database.query(
      `SELECT id, google_sub, email, name, avatar_url, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    return User.fromRow(rows[0]);
  }

  async findByGoogleSub(googleSub) {
    const { rows } = await this.database.query(
      `SELECT id, google_sub, email, name, avatar_url, created_at, updated_at
       FROM users
       WHERE google_sub = $1`,
      [googleSub]
    );
    return User.fromRow(rows[0]);
  }

  /**
   * Atomically creates or updates a user keyed by immutable `google_sub`.
   * Never uses mutable email as primary identity lookup.
   */
  async upsertFromOAuthProfile(profile) {
    const { rows } = await this.database.query(
      `INSERT INTO users (google_sub, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_sub) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         avatar_url = EXCLUDED.avatar_url,
         updated_at = NOW()
       RETURNING id, google_sub, email, name, avatar_url, created_at, updated_at`,
      [profile.providerSub, profile.email, profile.name, profile.avatarUrl]
    );
    return User.fromRow(rows[0]);
  }

  /**
   * Lists all users with their assigned role names and effective permission slugs
   * in a single aggregated query (avoids N+1 queries).
   */
  async findAllWithAccessSummary() {
    const { rows } = await this.database.query(
      `SELECT
         u.id,
         u.google_sub,
         u.email,
         u.name,
         u.avatar_url,
         u.created_at,
         u.updated_at,
         COALESCE(
           ARRAY_AGG(DISTINCT r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL),
           '{}'
         ) AS roles,
         COALESCE(
           ARRAY_AGG(DISTINCT p.slug ORDER BY p.slug) FILTER (WHERE p.slug IS NOT NULL),
           '{}'
         ) AS permissions
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       GROUP BY u.id
       ORDER BY u.created_at ASC`
    );

    return rows.map((row) => ({
      ...User.fromRow(row).toDTO(),
      roles: row.roles,
      permissions: row.permissions,
    }));
  }
}
