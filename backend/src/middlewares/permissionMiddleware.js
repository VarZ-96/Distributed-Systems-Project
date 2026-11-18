import { ForbiddenError, UnauthorizedError } from '../models/errors.js';

/**
 * Middleware Factory (Chain of Responsibility Pattern):
 * Resolves effective permissions dynamically from PostgreSQL via `RbacService`.
 * Zero hardcoded role checks (never `if (role === 'admin')`).
 * Fails closed with 403 Forbidden and `{ error: 'FORBIDDEN', required_permission }`.
 */
export function createPermissionMiddleware(rbacService) {
  return function requirePermission(permissionSlug) {
    if (!permissionSlug || typeof permissionSlug !== 'string') {
      throw new Error('requirePermission requires a non-empty permission slug');
    }

    return async function enforcePermission(req, _res, next) {
      try {
        if (!req.userId) {
          throw new UnauthorizedError('Authentication required before permission check');
        }

        const allowed = await rbacService.hasPermission(req.userId, permissionSlug);
        if (!allowed) {
          throw new ForbiddenError(
            `Access denied. Missing required permission '${permissionSlug}'.`,
            permissionSlug
          );
        }

        return next();
      } catch (error) {
        return next(error);
      }
    };
  };
}
