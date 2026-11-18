import { Router } from 'express';

export function createAdminRoutes({ adminController, requireAuth, requirePermission }) {
  const router = Router();

  router.get(
    '/api/admin/users',
    requireAuth,
    requirePermission('users:manage_roles'),
    adminController.listUsers
  );

  router.patch(
    '/api/admin/users/:id/role',
    requireAuth,
    requirePermission('users:manage_roles'),
    adminController.updateUserRole
  );

  return router;
}
