import { Permission, Role } from '../models/entities.js';
import { ConflictError, NotFoundError } from '../models/errors.js';

/**
 * Repository Pattern: encapsulates all SQL queries for RBAC tables
 * (`roles`, `permissions`, `role_permissions`, `user_roles`).
 */
export class RbacRepository {
  constructor(database) {
    this.database = database;
  }

  async findRoleByName(roleName) {
    const { rows } = await this.database.query(
      `SELECT id, name, description
       FROM roles
       WHERE name = $1`,
      [roleName]
    );
    return Role.fromRow(rows[0]);
  }

  async findAllRoles() {
    const { rows } = await this.database.query(
      `SELECT id, name, description
       FROM roles
       ORDER BY name ASC`
    );
    return rows.map(Role.fromRow);
  }

  async getUserRoles(userId) {
    const { rows } = await this.database.query(
      `SELECT r.id, r.name, r.description
       FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1
       ORDER BY r.name ASC`,
      [userId]
    );
    return rows.map(Role.fromRow);
  }

  async getUserPermissions(userId) {
    const { rows } = await this.database.query(
      `SELECT DISTINCT p.id, p.slug, p.description
       FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       INNER JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1
       ORDER BY p.slug ASC`,
      [userId]
    );
    return rows.map(Permission.fromRow);
  }

  async hasPermission(userId, permissionSlug) {
    const { rows } = await this.database.query(
      `SELECT 1
       FROM user_roles ur
       INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1 AND p.slug = $2
       LIMIT 1`,
      [userId, permissionSlug]
    );
    return rows.length > 0;
  }

  async assignRole(userId, roleName) {
    const { rows } = await this.database.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, r.id
       FROM roles r
       WHERE r.name = $2
       ON CONFLICT (user_id, role_id) DO NOTHING
       RETURNING role_id`,
      [userId, roleName]
    );
    return rows.length > 0;
  }

  async ensureBootstrapRole(userId, desiredRoleName) {
    return this.database.withTransaction(async (client) => {
      const { rows: roleRows } = await client.query(
        `SELECT id, name FROM roles WHERE name = $1`,
        [desiredRoleName]
      );
      if (roleRows.length === 0) {
        throw new NotFoundError(`Role '${desiredRoleName}' does not exist`);
      }

      const { rows: existingRoles } = await client.query(
        `SELECT r.name
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [userId]
      );

      // If bootstrapping an admin via ADMIN_EMAILS, ensure they hold admin (and clean single primary role)
      if (desiredRoleName === 'admin') {
        const alreadyAdmin = existingRoles.some((r) => r.name === 'admin');
        if (!alreadyAdmin) {
          await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
          await client.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, roleRows[0].id]
          );
        }
        return;
      }

      // Least privilege: assign default role only if the user currently has no roles
      if (existingRoles.length === 0) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, roleRows[0].id]
        );
      }
    });
  }

  /**
   * Atomically replaces a user's assigned role inside an ACID transaction.
   * Uses row-level locking (`FOR UPDATE`) on the `admin` role record to guarantee
   * concurrency-safe last-admin lockout protection.
   */
  async replaceUserRole(userId, newRoleName) {
    return this.database.withTransaction(async (client) => {
      const { rows: userRows } = await client.query(
        `SELECT id FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (userRows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const { rows: targetRoleRows } = await client.query(
        `SELECT id, name FROM roles WHERE name = $1`,
        [newRoleName]
      );
      if (targetRoleRows.length === 0) {
        throw new NotFoundError(`Role '${newRoleName}' does not exist`);
      }
      const targetRole = targetRoleRows[0];

      // Lock the `admin` role row to serialize concurrent admin demotions
      const { rows: adminRoleRows } = await client.query(
        `SELECT id FROM roles WHERE name = 'admin' FOR UPDATE`
      );
      const adminRoleId = adminRoleRows[0]?.id;

      if (adminRoleId && newRoleName !== 'admin') {
        const { rows: currentRoles } = await client.query(
          `SELECT role_id FROM user_roles WHERE user_id = $1`,
          [userId]
        );
        const userIsCurrentlyAdmin = currentRoles.some((r) => r.role_id === adminRoleId);

        if (userIsCurrentlyAdmin) {
          const { rows: adminCountRows } = await client.query(
            `SELECT COUNT(*)::int AS admin_count
             FROM user_roles
             WHERE role_id = $1`,
            [adminRoleId]
          );
          if (adminCountRows[0].admin_count <= 1) {
            throw new ConflictError(
              'Cannot demote the last remaining admin. Promote another user to admin first.'
            );
          }
        }
      }

      await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [userId, targetRole.id]
      );

      return targetRole.name;
    });
  }
}
