import { AppError, NotFoundError } from '../models/errors.js';

export function notFoundHandler(req, _res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}

/**
 * Centralized Express error handler.
 * Serializes operational AppError subclasses cleanly and suppresses internal stack traces.
 */
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toResponseBody());
  }

  // Handle malformed JSON bodies from express.json()
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Malformed JSON request body',
    });
  }

  // Handle PostgreSQL invalid UUID syntax (22P02) cleanly without leaking DB details
  if (err?.code === '22P02') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid identifier format',
    });
  }

  console.error('[UnhandledError]', {
    name: err?.name,
    message: err?.message,
    code: err?.code,
  });

  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected internal error occurred',
  });
}
