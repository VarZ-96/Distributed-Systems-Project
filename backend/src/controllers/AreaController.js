/**
 * Thin HTTP adapter for RBAC-protected resource endpoints (`/student-area`, `/admin-area`).
 * Zero hardcoded role checks — authorization is enforced declaratively via `requirePermission(...)`.
 */
export class AreaController {
  constructor({ authService }) {
    this.authService = authService;
  }

  getStudentArea = async (req, res, next) => {
    try {
      const user = await this.authService.getCurrentUserProfile(req.userId);
      return res.status(200).json({
        area: 'student-area',
        status: 'AUTHORIZED',
        required_permission: 'student_area:access',
        message: `Welcome to the Student Area, ${user.name}!`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions,
        },
        resources: [
          { id: 'CS-401', title: 'Distributed Systems — OAuth 2.0 & RBAC Lab', status: 'Active' },
          { id: 'CS-402', title: 'Consensus Algorithms & Replication Notes', status: 'Available' },
          { id: 'CS-403', title: 'API Security & Zero-Trust Architecture Guide', status: 'Available' },
        ],
        evaluatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return next(error);
    }
  };

  getAdminArea = async (req, res, next) => {
    try {
      const user = await this.authService.getCurrentUserProfile(req.userId);
      return res.status(200).json({
        area: 'admin-area',
        status: 'AUTHORIZED',
        required_permission: 'admin_area:access',
        message: `Welcome to the Admin Area, ${user.name}. Elevated privileges verified live from PostgreSQL.`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions,
        },
        securityPosture: {
          authentication: 'Google OAuth 2.0 (Authorization Code + PKCE + CSRF state)',
          sessionToken: 'Identity-only HttpOnly JWT (sub claim only)',
          authorization: 'Dynamic 5-table PostgreSQL RBAC (zero stale role claims)',
          lockoutProtection: 'Transactional last-admin demotion guard enabled',
        },
        evaluatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return next(error);
    }
  };
}
