import { ValidationError } from '../models/errors.js';

/**
 * Single Responsibility: dynamic database-driven RBAC resolution and role governance.
 * Permissions are always resolved live from PostgreSQL — zero stale JWT claims.
 */
export class RbacService {
  constructor(rbacRepository) {
    this.rbacRepository = rbacRepository;
  }

  async getUserAccessContext(userId) {
    const [roles, permissions] = await Promise.all([
      this.rbacRepository.getUserRoles(userId),
      this.rbacRepository.getUserPermissions(userId),
    ]);

    return {
      roles: roles.map((r) => r.name),
      permissions: permissions.map((p) => p.slug),
    };
  }

  async hasPermission(userId, permissionSlug) {
    if (!userId || !permissionSlug) {
      return false;
    }
    return this.rbacRepository.hasPermission(userId, permissionSlug);
  }

  /**
   * Applies least-privilege role bootstrapping on login:
   * - Emails in `ADMIN_EMAILS` receive `admin`
   * - All other new users default to `student`
   */
  async bootstrapUserRole(user, adminEmails) {
    const isBootstrapAdmin = adminEmails.has(user.email.toLowerCase());
    const desiredRole = isBootstrapAdmin ? 'admin' : 'student';
    await this.rbacRepository.ensureBootstrapRole(user.id, desiredRole);
  }

  async updateUserRole(targetUserId, newRoleName) {
    const normalizedRole = String(newRoleName || '').trim().toLowerCase();
    const role = await this.rbacRepository.findRoleByName(normalizedRole);
    if (!role) {
      throw new ValidationError(`Unknown role '${newRoleName}'. Allowed roles are managed in PostgreSQL.`);
    }

    await this.rbacRepository.replaceUserRole(targetUserId, role.name);
    return this.getUserAccessContext(targetUserId);
  }
}
