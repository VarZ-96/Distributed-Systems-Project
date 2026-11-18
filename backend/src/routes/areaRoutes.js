import { Router } from 'express';

/**
 * Declarative RBAC-protected resource routes.
 * Authorization is enforced strictly by atomic permission slugs — zero hardcoded role checks.
 */
export function createAreaRoutes({ areaController, requireAuth, requirePermission }) {
  const router = Router();

  router.get(
    '/student-area',
    requireAuth,
    requirePermission('student_area:access'),
    areaController.getStudentArea
  );

  router.get(
    '/admin-area',
    requireAuth,
    requirePermission('admin_area:access'),
    areaController.getAdminArea
  );

  return router;
}
