import { AdminRoleManager } from './components/AdminRoleManager.jsx';
import { EndpointTesterPanel } from './components/EndpointTesterPanel.jsx';
import { HeaderProfileCard } from './components/HeaderProfileCard.jsx';
import { useAuth } from './hooks/useAuth.js';

export function App() {
  const {
    user,
    loading,
    authError,
    dismissAuthError,
    refreshAuth,
    loginWithGoogle,
    logout,
    hasPermission,
  } = useAuth();

  return (
    <div className="app-shell">
      <div className="container">
        <HeaderProfileCard
          user={user}
          loading={loading}
          authError={authError}
          onDismissError={dismissAuthError}
          onLogin={loginWithGoogle}
          onLogout={logout}
          onRefresh={refreshAuth}
        />

        <div className="architecture-strip">
          <div className="arch-pill">
            <strong>AuthN:</strong> Google OAuth 2.0 + PKCE + CSRF State → Identity-Only{' '}
            <code>HttpOnly</code> JWT (<code>sub</code> only)
          </div>
          <div className="arch-pill">
            <strong>AuthZ:</strong> Live 5-Table PostgreSQL RBAC (Atomic Permission Slugs)
          </div>
        </div>

        <EndpointTesterPanel />

        {hasPermission('users:manage_roles') && (
          <AdminRoleManager currentUserId={user.id} onRoleChanged={refreshAuth} />
        )}
      </div>
    </div>
  );
}

export default App;
