const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(
  /\/+$/,
  ''
);

/**
 * Low-level HTTP helper configured for HttpOnly cookie authentication.
 * Never reads or stores JWTs in localStorage/sessionStorage.
 * Always returns `{ status, ok, durationMs, data }` so the UI can inspect 401/403/200 cleanly.
 */
async function request(path, options = {}) {
  const startedAt = performance.now();
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });

    const durationMs = Math.round(performance.now() - startedAt);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    return {
      status: response.status,
      ok: response.ok,
      durationMs,
      data,
    };
  } catch {
    return {
      status: 0,
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      data: {
        error: 'NETWORK_ERROR',
        message: `Could not reach backend at ${API_BASE_URL}. Ensure the Express server is running.`,
      },
    };
  }
}

export const apiClient = {
  getGoogleLoginUrl() {
    return `${API_BASE_URL}/auth/google/login`;
  },

  getMe() {
    return request('/api/me', { method: 'GET' });
  },

  logout() {
    return request('/auth/logout', { method: 'POST' });
  },

  getStudentArea() {
    return request('/student-area', { method: 'GET' });
  },

  getAdminArea() {
    return request('/admin-area', { method: 'GET' });
  },

  listUsers() {
    return request('/api/admin/users', { method: 'GET' });
  },

  updateUserRole(userId, role) {
    return request(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },
};
