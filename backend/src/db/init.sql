-- =============================================================================
-- PostgreSQL 5-Table RBAC Schema + Idempotent Seed
-- Separation of Concerns:
--   Authentication identity (google_sub) lives in `users`
--   Authorization (roles & atomic permission slugs) lives in RBAC tables
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Users (keyed by immutable Google `sub` claim, never mutable email)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT ''
);

-- 3. Permissions (atomic capability slugs)
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

-- 4. Role <-> Permission mapping (composite PK, ON DELETE RESTRICT)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  PRIMARY KEY (role_id, permission_id)
);

-- 5. User <-> Role mapping (composite PK, ON DELETE RESTRICT)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);

-- Indexes for fast RBAC lookups and admin-count governance checks
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- =============================================================================
-- Idempotent Seed Data (ON CONFLICT DO NOTHING)
-- =============================================================================

INSERT INTO roles (name, description) VALUES
  ('student', 'Default authenticated user role with access to the student area'),
  ('admin', 'Elevated administrator role with access to admin area and user role governance')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (slug, description) VALUES
  ('student_area:access', 'Access the protected student area endpoint and resources'),
  ('admin_area:access', 'Access the protected admin area endpoint and system metrics'),
  ('users:manage_roles', 'View all users and modify user role assignments')
ON CONFLICT (slug) DO NOTHING;

-- Assign permissions to 'student'
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug IN ('student_area:access')
WHERE r.name = 'student'
ON CONFLICT DO NOTHING;

-- Assign permissions to 'admin'
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug IN ('student_area:access', 'admin_area:access', 'users:manage_roles')
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
