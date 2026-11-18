import { UnauthorizedError } from '../models/errors.js';

/**
 * Middleware Factory (Chain of Responsibility Pattern):
 * Verifies the HttpOnly identity-only JWT cookie and attaches `req.userId`.
 * Fails closed with 401 Unauthorized on missing, expired, or tampered tokens.
 */
export function createAuthMiddleware(tokenService, cookieName = 'auth_token') {
  return function requireAuth(req, _res, next) {
    try {
      const token = req.cookies?.[cookieName];
      if (!token) {
        throw new UnauthorizedError('Authentication required. Please log in with Google.');
      }

      const { userId } = tokenService.verifyIdentityToken(token);
      req.userId = userId;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
