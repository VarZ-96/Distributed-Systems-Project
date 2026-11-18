import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';

const AUTH_ERROR_MESSAGES = {
  oauth_cancelled: 'Google sign-in was cancelled before completing consent.',
  oauth_failed: 'Google authentication failed or CSRF/PKCE validation did not pass. Please try again.',
};

/**
 * Manages authenticated identity & live PostgreSQL RBAC permissions.
 * Permission checks use atomic permission slugs (`hasPermission`) — never hardcoded role names.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    const result = await apiClient.getMe();
    if (result.ok && result.data?.user) {
      setUser(result.data.user);
    } else {
      setUser(null);
    }
    setLoading(false);
    return result;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('auth_error');
    if (errorCode) {
      setAuthError(AUTH_ERROR_MESSAGES[errorCode] || 'Authentication could not be completed.');
      params.delete('auth_error');
      const cleaned = params.toString();
      const nextUrl = `${window.location.pathname}${cleaned ? `?${cleaned}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    }

    refreshAuth();
  }, [refreshAuth]);

  const loginWithGoogle = useCallback(() => {
    window.location.assign(apiClient.getGoogleLoginUrl());
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
    setAuthError(null);
  }, []);

  const hasPermission = useCallback(
    (slug) => Boolean(user?.permissions?.includes(slug)),
    [user]
  );

  return {
    user,
    loading,
    authError,
    dismissAuthError: () => setAuthError(null),
    refreshAuth,
    loginWithGoogle,
    logout,
    hasPermission,
  };
}
