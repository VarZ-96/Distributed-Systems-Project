import { ForbiddenError } from '../models/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defense-in-depth CSRF protection complementing `SameSite=Lax` HttpOnly cookies.
 * Validates the `Origin` header on all state-changing browser requests.
 */
export function createCsrfOriginMiddleware(allowedOrigin) {
  return function verifyCsrfOrigin(req, _res, next) {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    const origin = req.get('origin');
    if (origin && origin !== allowedOrigin) {
      return next(new ForbiddenError('Cross-origin state-changing request rejected'));
    }

    return next();
  };
}
