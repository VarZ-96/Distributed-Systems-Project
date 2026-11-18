import { Router } from 'express';

export function createAuthRoutes({ authController, requireAuth }) {
  const router = Router();

  router.get('/auth/google/login', authController.login);
  router.get('/auth/google/callback', authController.callback);
  router.post('/auth/logout', authController.logout);
  router.get('/api/me', requireAuth, authController.me);

  return router;
}
