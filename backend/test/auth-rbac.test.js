import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { AppConfig } from '../src/config/AppConfig.js';
import { AdminController } from '../src/controllers/AdminController.js';
import { createAuthMiddleware } from '../src/middlewares/authMiddleware.js';
import { createPermissionMiddleware } from '../src/middlewares/permissionMiddleware.js';
import { AuthProfile, User } from '../src/models/entities.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../src/models/errors.js';
import { OAuthProvider } from '../src/providers/OAuthProvider.js';
import { AuthService } from '../src/services/AuthService.js';
import { TokenService } from '../src/services/TokenService.js';

const TEST_JWT_CONFIG = {
  secret: 'unit-test-secret-key-at-least-32-characters-long',
  expiresIn: '1h',
  issuer: 'oauth-rbac-demo',
  audience: 'oauth-rbac-demo-client',
};

class MockOAuthProvider extends OAuthProvider {
  get providerName() {
    return 'mock-google';
  }

  createAuthorizationUrl({ state, codeChallenge }) {
    return `https://accounts.example.test/auth?state=${state}&code_challenge=${codeChallenge}`;
  }

  async exchangeCodeForProfile({ code, codeVerifier }) {
    if (!code || !codeVerifier) {
      throw new UnauthorizedError('Missing code or PKCE verifier');
    }
    return new AuthProfile({
      provider: this.providerName,
      providerSub: 'google-sub-12345',
      email: code === 'admin-code' ? 'admin@college.edu' : 'student@college.edu',
      emailVerified: true,
      name: code === 'admin-code' ? 'Admin User' : 'Student User',
      avatarUrl: 'https://example.test/avatar.png',
    });
  }
}

describe('TokenService (Identity-Only JWT & PKCE)', () => {
  const tokenService = new TokenService(TEST_JWT_CONFIG);

  it('signs an identity-only JWT containing sub without roles or permissions', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const token = tokenService.signIdentityToken(userId);
    const decoded = jwt.decode(token);

    assert.equal(decoded.sub, userId);
    assert.equal(decoded.role, undefined);
    assert.equal(decoded.roles, undefined);
    assert.equal(decoded.permissions, undefined);

    const verified = tokenService.verifyIdentityToken(token);
    assert.equal(verified.userId, userId);
  });

  it('rejects tokens signed with a different secret', () => {
    const forged = jwt.sign({}, 'wrong-secret-key-that-is-32-chars-long!!', {
      subject: 'user-1',
      issuer: TEST_JWT_CONFIG.issuer,
      audience: TEST_JWT_CONFIG.audience,
    });

    assert.throws(() => tokenService.verifyIdentityToken(forged), UnauthorizedError);
  });

  it('generates valid S256 PKCE pairs and compares CSRF state safely', () => {
    const { codeVerifier, codeChallenge } = tokenService.generatePkcePair();
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    assert.equal(codeChallenge, expectedChallenge);

    const state = tokenService.generateOAuthState();
    assert.equal(tokenService.verifyStateMatch(state, state), true);
    assert.equal(tokenService.verifyStateMatch(state, 'tampered-state'), false);
    assert.equal(tokenService.verifyStateMatch('', state), false);
  });
});

describe('AuthService (Dependency Inversion + OAuth CSRF & Bootstrap)', () => {
  const tokenService = new TokenService(TEST_JWT_CONFIG);
  const oauthProvider = new MockOAuthProvider();

  it('rejects callback when CSRF state does not match', async () => {
    const authService = new AuthService({
      oauthProvider,
      userRepository: {},
      rbacService: {},
      tokenService,
      adminEmails: new Set(),
    });

    await assert.rejects(
      () =>
        authService.handleCallback({
          code: 'student-code',
          receivedState: 'attacker-state',
          expectedState: 'legit-state',
          codeVerifier: 'verifier-123',
        }),
      UnauthorizedError
    );
  });

  it('assigns student role by default and admin role for ADMIN_EMAILS', async () => {
    const assignedRoles = [];
    const mockUserRepo = {
      async upsertFromOAuthProfile(profile) {
        return new User({
          id: '550e8400-e29b-41d4-a716-446655440001',
          googleSub: profile.providerSub,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          createdAt: new Date().toISOString(),
        });
      },
    };
    const mockRbacService = {
      async bootstrapUserRole(user, adminEmails) {
        assignedRoles.push(adminEmails.has(user.email) ? 'admin' : 'student');
      },
      async getUserAccessContext() {
        const last = assignedRoles[assignedRoles.length - 1];
        return {
          roles: [last],
          permissions:
            last === 'admin'
              ? ['student_area:access', 'admin_area:access', 'users:manage_roles']
              : ['student_area:access'],
        };
      },
    };

    const authService = new AuthService({
      oauthProvider,
      userRepository: mockUserRepo,
      rbacService: mockRbacService,
      tokenService,
      adminEmails: new Set(['admin@college.edu']),
    });

    const studentLogin = await authService.handleCallback({
      code: 'student-code',
      receivedState: 'same-state',
      expectedState: 'same-state',
      codeVerifier: 'verifier-123',
    });
    assert.deepEqual(studentLogin.user.roles, ['student']);

    const adminLogin = await authService.handleCallback({
      code: 'admin-code',
      receivedState: 'same-state',
      expectedState: 'same-state',
      codeVerifier: 'verifier-123',
    });
    assert.deepEqual(adminLogin.user.roles, ['admin']);
  });
});

describe('Auth & Permission Middlewares (Fail-Closed & Live RBAC)', () => {
  const tokenService = new TokenService(TEST_JWT_CONFIG);
  const requireAuth = createAuthMiddleware(tokenService, 'auth_token');

  it('returns 401 UnauthorizedError when auth cookie is missing', () => {
    let capturedError = null;
    requireAuth({ cookies: {} }, {}, (err) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof UnauthorizedError);
    assert.equal(capturedError.statusCode, 401);
  });

  it('returns 403 ForbiddenError with required_permission and reflects live role updates without re-login', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440002';
    const token = tokenService.signIdentityToken(userId);

    // Simulate live DB permissions changing from student -> admin without re-issuing JWT
    let dbPermissions = new Set(['student_area:access']);
    const rbacService = {
      async hasPermission(_uid, slug) {
        return dbPermissions.has(slug);
      },
    };

    const requirePermission = createPermissionMiddleware(rbacService);
    const guardAdminArea = requirePermission('admin_area:access');

    // Step 1: Authenticate using the same identity-only JWT
    const req = { cookies: { auth_token: token } };
    let authErr = null;
    requireAuth(req, {}, (err) => {
      authErr = err ?? null;
    });
    assert.equal(authErr, null);
    assert.equal(req.userId, userId);

    // Step 2: Denied (403) while student
    let permErr = null;
    await guardAdminArea(req, {}, (err) => {
      permErr = err ?? null;
    });
    assert.ok(permErr instanceof ForbiddenError);
    assert.equal(permErr.statusCode, 403);
    assert.deepEqual(permErr.toResponseBody(), {
      error: 'FORBIDDEN',
      message: "Access denied. Missing required permission 'admin_area:access'.",
      required_permission: 'admin_area:access',
    });

    // Step 3: Live promotion in DB — SAME JWT immediately succeeds with zero re-login
    dbPermissions = new Set(['student_area:access', 'admin_area:access', 'users:manage_roles']);
    permErr = null;
    await guardAdminArea(req, {}, (err) => {
      permErr = err ?? null;
    });
    assert.equal(permErr, null);
  });
});

describe('AppConfig & AdminController Validation (Zod v4)', () => {
  it('fails fast when JWT_SECRET is too short and parses ADMIN_EMAILS cleanly when valid', () => {
    const baseEnv = {
      NODE_ENV: 'test',
      PORT: '4000',
      FRONTEND_URL: 'http://localhost:5173/',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/oauth_rbac_demo',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:4000/auth/google/callback',
      JWT_SECRET: 'too-short',
      ADMIN_EMAILS: ' Admin@College.EDU , second@college.edu ',
    };

    assert.throws(() => new AppConfig(baseEnv), /JWT_SECRET/);

    const config = new AppConfig({
      ...baseEnv,
      JWT_SECRET: 'this-is-a-strong-secret-key-at-least-32-characters',
    });
    assert.equal(config.frontendUrl, 'http://localhost:5173');
    assert.equal(config.adminEmails.has('admin@college.edu'), true);
    assert.equal(config.adminEmails.has('second@college.edu'), true);
  });

  it('rejects invalid UUID and unknown role in AdminController.updateUserRole', async () => {
    const controller = new AdminController({ adminService: {} });

    let err1 = null;
    await controller.updateUserRole(
      { params: { id: 'not-a-uuid' }, body: { role: 'admin' } },
      {},
      (err) => {
        err1 = err;
      }
    );
    assert.ok(err1 instanceof ValidationError);

    let err2 = null;
    await controller.updateUserRole(
      {
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
        body: { role: 'superadmin' },
      },
      {},
      (err) => {
        err2 = err;
      }
    );
    assert.ok(err2 instanceof ValidationError);
  });
});
