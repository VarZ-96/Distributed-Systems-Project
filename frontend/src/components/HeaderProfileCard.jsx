function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.57.38-2.29v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76z"
      />
    </svg>
  );
}

export function HeaderProfileCard({
  user,
  loading,
  authError,
  onDismissError,
  onLogin,
  onLogout,
  onRefresh,
}) {
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <header className="card profile-card">
      <div className="profile-top">
        <div>
          <div className="eyebrow">Google OAuth 2.0 (AuthN) + PostgreSQL RBAC (AuthZ)</div>
          <h1>Distributed Identity &amp; Access Control Console</h1>
        </div>
        <div className="auth-actions">
          {user ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onRefresh}>
                Refresh Access
              </button>
              <button type="button" className="btn btn-danger" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-google"
              onClick={onLogin}
              disabled={loading}
            >
              <GoogleIcon />
              <span>Login with Google</span>
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="alert alert-error" role="alert">
          <span>{authError}</span>
          <button type="button" className="alert-close" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="profile-body">
        {loading ? (
          <p className="muted">Checking HttpOnly session cookie...</p>
        ) : user ? (
          <div className="identity-grid">
            <div className="identity-user">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="avatar avatar-fallback">{initials}</div>
              )}
              <div>
                <div className="user-name-row">
                  <span className="user-name">{user.name}</span>
                  <span className="status-pill status-ok">Authenticated</span>
                </div>
                <div className="user-email">{user.email}</div>
                <div className="user-id">Local User ID: {user.id}</div>
              </div>
            </div>

            <div className="access-badges">
              <div className="badge-group">
                <span className="badge-label">Assigned Roles (PostgreSQL)</span>
                <div className="badge-list">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className={`role-badge ${role === 'admin' ? 'role-admin' : 'role-student'}`}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div className="badge-group">
                <span className="badge-label">Effective Permission Slugs (Live)</span>
                <div className="badge-list">
                  {user.permissions.map((perm) => (
                    <code key={perm} className="perm-chip">
                      {perm}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="logged-out-banner">
            <span className="status-pill status-warn">Logged Out</span>
            <p className="muted">
              No active session cookie. Test <code>GET /student-area</code> and{' '}
              <code>GET /admin-area</code> below to verify <strong>401 Unauthorized</strong>{' '}
              fail-closed behavior, then sign in with Google.
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
