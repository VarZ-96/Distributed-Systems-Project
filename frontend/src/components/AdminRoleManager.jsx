import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client.js';

/**
 * Admin Role Manager: rendered strictly when the authenticated user holds
 * the `users:manage_roles` permission slug from PostgreSQL.
 */
export function AdminRoleManager({ currentUserId, onRoleChanged }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const result = await apiClient.listUsers();
    if (result.ok && Array.isArray(result.data?.users)) {
      setUsers(result.data.users);
    } else {
      setFeedback({
        type: 'error',
        text: result.data?.message || 'Failed to load user directory.',
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (targetUser, nextRole) => {
    const currentRole = targetUser.roles[0] || 'student';
    if (currentRole === nextRole) return;

    setUpdatingUserId(targetUser.id);
    setFeedback(null);

    const result = await apiClient.updateUserRole(targetUser.id, nextRole);
    setUpdatingUserId(null);

    if (result.ok) {
      setFeedback({
        type: 'success',
        text: `Updated ${targetUser.email} to '${nextRole}'. Permissions took effect immediately (no re-login required).`,
      });
      await loadUsers();
      if (targetUser.id === currentUserId) {
        await onRoleChanged();
      }
    } else {
      setFeedback({
        type: 'error',
        text: `[${result.status}] ${result.data?.message || 'Unable to update user role.'}`,
      });
    }
  };

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Admin Role Manager</h2>
          <p className="muted">
            Permission-gated via <code>users:manage_roles</code>. Role updates write directly to
            PostgreSQL with transactional last-admin lockout protection and apply immediately
            without re-login.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadUsers}
          disabled={loading}
        >
          Reload Users
        </button>
      </div>

      {feedback && (
        <div
          className={`alert ${feedback.type === 'error' ? 'alert-error' : 'alert-success'}`}
          role="status"
        >
          <span>{feedback.text}</span>
          <button type="button" className="alert-close" onClick={() => setFeedback(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading users from PostgreSQL...</p>
      ) : (
        <div className="table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Current Role</th>
                <th>Effective Permissions</th>
                <th>Change Role (Live)</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const activeRole = u.roles[0] || 'student';
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="table-user">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className="avatar-sm"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="avatar-sm avatar-fallback">
                            {u.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="table-user-name">
                            {u.name} {isSelf && <span className="you-tag">You</span>}
                          </div>
                          <div className="table-user-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`role-badge ${
                          activeRole === 'admin' ? 'role-admin' : 'role-student'
                        }`}
                      >
                        {activeRole}
                      </span>
                    </td>
                    <td>
                      <div className="badge-list">
                        {u.permissions.map((slug) => (
                          <code key={slug} className="perm-chip">
                            {slug}
                          </code>
                        ))}
                      </div>
                    </td>
                    <td>
                      <select
                        aria-label={`Role for ${u.email}`}
                        className="role-select"
                        value={activeRole}
                        disabled={updatingUserId === u.id}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                      >
                        <option value="student">student</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
