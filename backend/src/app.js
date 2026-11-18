import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { createAdminRoutes } from './routes/adminRoutes.js';
import { createAreaRoutes } from './routes/areaRoutes.js';
import { createAuthRoutes } from './routes/authRoutes.js';

/**
 * Builds the configured Express application from the DI container.
 * Separated from `server.js` so the app can be tested cleanly without binding a port.
 */
export function createApp(container) {
  const { config, database, middlewares, controllers } = container;
  const app = express();

  app.disable('x-powered-by');
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  // Security headers
  app.use(helmet());

  // Strict CORS: exact frontend origin with credentials enabled (never wildcard `*`)
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
    })
  );

  // Body & cookie parsing with strict payload size limit
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());

  // Defense-in-depth CSRF Origin verification for mutating routes
  app.use(middlewares.verifyCsrfOrigin);

  // Rate limiting (protects auth & API endpoints from brute-force/abuse)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED', message: 'Too many authentication requests, try again later.' },
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED', message: 'Too many requests, please slow down.' },
  });

  app.use('/auth', authLimiter);
  app.use(['/api', '/student-area', '/admin-area'], apiLimiter);

  // Health / readiness check
  app.get('/health', async (_req, res) => {
    try {
      await database.ping();
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(503).json({
        status: 'degraded',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Feature routes
  app.use(
    createAuthRoutes({
      authController: controllers.authController,
      requireAuth: middlewares.requireAuth,
    })
  );
  app.use(
    createAreaRoutes({
      areaController: controllers.areaController,
      requireAuth: middlewares.requireAuth,
      requirePermission: middlewares.requirePermission,
    })
  );
  app.use(
    createAdminRoutes({
      adminController: controllers.adminController,
      requireAuth: middlewares.requireAuth,
      requirePermission: middlewares.requirePermission,
    })
  );

  // Centralized 404 & Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
