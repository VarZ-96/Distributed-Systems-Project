import { useState } from 'react';
import { apiClient } from '../api/client.js';

function getStatusBadgeClass(status) {
  if (status >= 200 && status < 300) return 'http-200';
  if (status === 401) return 'http-401';
  if (status === 403) return 'http-403';
  return 'http-err';
}

function getStatusText(status) {
  if (status === 200) return '200 OK';
  if (status === 401) return '401 Unauthorized';
  if (status === 403) return '403 Forbidden';
  if (status === 0) return 'Network Error';
  return `${status}`;
}

function EndpointCard({ title, method, path, requiredPermission, description, onCall }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleInvoke = async () => {
    setLoading(true);
    const res = await onCall();
    setResult(res);
    setLoading(false);
  };

  return (
    <article className="endpoint-card">
      <div className="endpoint-header">
        <div>
          <h3>{title}</h3>
          <div className="endpoint-meta">
            <span className="method-pill">{method}</span>
            <code className="endpoint-path">{path}</code>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleInvoke}
          disabled={loading}
        >
          {loading ? 'Calling...' : `Call ${path}`}
        </button>
      </div>

      <p className="endpoint-desc">
        {description}{' '}
        <span className="req-perm">
          Requires: <code>{requiredPermission}</code>
        </span>
      </p>

      <div className="response-box">
        <div className="response-toolbar">
          <span className="response-label">Response</span>
          {result ? (
            <div className="response-status-row">
              <span className={`http-badge ${getStatusBadgeClass(result.status)}`}>
                {getStatusText(result.status)}
              </span>
              <span className="latency">{result.durationMs} ms</span>
            </div>
          ) : (
            <span className="muted small">Not called yet</span>
          )}
        </div>

        <pre className="json-viewer">
          {result
            ? JSON.stringify(result.data, null, 2)
            : '// Click the button above to inspect the live HTTP status & JSON payload'}
        </pre>
      </div>
    </article>
  );
}

export function EndpointTesterPanel() {
  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Protected Endpoint Tester</h2>
          <p className="muted">
            Both endpoints remain clickable at all times so you can verify{' '}
            <strong>401 Unauthorized</strong> (logged out), <strong>200 / 403</strong> (student),
            and <strong>200 / 200</strong> (admin) live.
          </p>
        </div>
      </div>

      <div className="endpoint-grid">
        <EndpointCard
          title="Student Area"
          method="GET"
          path="/student-area"
          requiredPermission="student_area:access"
          description="Accessible to authenticated students and admins."
          onCall={() => apiClient.getStudentArea()}
        />

        <EndpointCard
          title="Admin Area"
          method="GET"
          path="/admin-area"
          requiredPermission="admin_area:access"
          description="Restricted to users holding the admin permission slug in PostgreSQL."
          onCall={() => apiClient.getAdminArea()}
        />
      </div>
    </section>
  );
}
