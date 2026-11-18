import { AppConfig } from './config/AppConfig.js';
import { Database } from './config/Database.js';
import { AdminController } from './controllers/AdminController.js';
import { AreaController } from './controllers/AreaController.js';
import { AuthController } from './controllers/AuthController.js';
import { DatabaseInitializer } from './db/DatabaseInitializer.js';
import { createAuthMiddleware } from './middlewares/authMiddleware.js';
import { createCsrfOriginMiddleware } from './middlewares/csrfOriginMiddleware.js';
import { createPermissionMiddleware } from './middlewares/permissionMiddleware.js';
import { GoogleOAuthProvider } from './providers/GoogleOAuthProvider.js';
import { RbacRepository } from './repositories/RbacRepository.js';
import { UserRepository } from './repositories/UserRepository.js';
import { AdminService } from './services/AdminService.js';
import { AuthService } from './services/AuthService.js';
import { RbacService } from './services/RbacService.js';
import { TokenService } from './services/TokenService.js';

/**
 * Composition Root (Dependency Injection Container):
 * Wires Database -> Repositories -> Providers -> Services -> Middlewares -> Controllers
 * in one explicit, easily inspectable place.
 */
export function createContainer(rawEnv = process.env) {
  // 1. Config & Infrastructure
  const config = new AppConfig(rawEnv);
  const database = Database.getInstance(config.databaseUrl);
  const databaseInitializer = new DatabaseInitializer(database);

  // 2. Repositories (Data-Access Layer)
  const userRepository = new UserRepository(database);
  const rbacRepository = new RbacRepository(database);

  // 3. OAuth Strategy Provider (Open/Closed Principle)
  const oauthProvider = new GoogleOAuthProvider({
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    redirectUri: config.google.redirectUri,
  });

  // 4. Domain Services (Constructor-Injected Business Logic)
  const tokenService = new TokenService(config.jwt);
  const rbacService = new RbacService(rbacRepository);
  const authService = new AuthService({
    oauthProvider,
    userRepository,
    rbacService,
    tokenService,
    adminEmails: config.adminEmails,
  });
  const adminService = new AdminService({
    userRepository,
    rbacService,
  });

  // 5. Middleware Factories (Chain of Responsibility)
  const requireAuth = createAuthMiddleware(tokenService, config.cookies.authTokenName);
  const requirePermission = createPermissionMiddleware(rbacService);
  const verifyCsrfOrigin = createCsrfOriginMiddleware(config.frontendUrl);

  // 6. Controllers (Thin HTTP Adapters)
  const authController = new AuthController({ authService, config });
  const areaController = new AreaController({ authService });
  const adminController = new AdminController({ adminService });

  return {
    config,
    database,
    databaseInitializer,
    repositories: { userRepository, rbacRepository },
    providers: { oauthProvider },
    services: { tokenService, rbacService, authService, adminService },
    middlewares: { requireAuth, requirePermission, verifyCsrfOrigin },
    controllers: { authController, areaController, adminController },
  };
}
