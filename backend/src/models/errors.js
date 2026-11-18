/**
 * Base operational error class (Liskov Substitution Principle).
 * All domain/HTTP errors extend AppError so the centralized error handler
 * serializes them predictably without leaking internal stack traces.
 */
export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toResponseBody() {
    const body = {
      error: this.code,
      message: this.message,
    };
    if (this.details && typeof this.details === 'object') {
      Object.assign(body, this.details);
    }
    return body;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, { statusCode: 401, code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions', requiredPermission = null) {
    super(message, {
      statusCode: 403,
      code: 'FORBIDDEN',
      details: requiredPermission ? { required_permission: requiredPermission } : null,
    });
    this.requiredPermission = requiredPermission;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, { statusCode: 404, code: 'NOT_FOUND' });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request payload', details = null) {
    super(message, { statusCode: 400, code: 'VALIDATION_ERROR', details });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Operation violates a business invariant') {
    super(message, { statusCode: 409, code: 'CONFLICT' });
  }
}
