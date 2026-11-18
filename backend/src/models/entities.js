/**
 * Domain entity representing a local user record keyed by immutable Google `sub`.
 */
export class User {
  constructor({ id, googleSub, email, name, avatarUrl, createdAt, updatedAt }) {
    this.id = id;
    this.googleSub = googleSub;
    this.email = email;
    this.name = name;
    this.avatarUrl = avatarUrl ?? null;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt ?? null;
  }

  static fromRow(row) {
    if (!row) return null;
    return new User({
      id: row.id,
      googleSub: row.google_sub,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  toDTO() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      avatarUrl: this.avatarUrl,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Domain entity representing an RBAC role.
 */
export class Role {
  constructor({ id, name, description = '' }) {
    this.id = id;
    this.name = name;
    this.description = description;
  }

  static fromRow(row) {
    if (!row) return null;
    return new Role({
      id: row.id,
      name: row.name,
      description: row.description,
    });
  }
}

/**
 * Domain entity representing an atomic RBAC permission slug.
 */
export class Permission {
  constructor({ id, slug, description }) {
    this.id = id;
    this.slug = slug;
    this.description = description;
  }

  static fromRow(row) {
    if (!row) return null;
    return new Permission({
      id: row.id,
      slug: row.slug,
      description: row.description,
    });
  }
}

/**
 * Provider-agnostic authenticated profile returned by any OAuthProvider implementation.
 */
export class AuthProfile {
  constructor({ provider, providerSub, email, emailVerified, name, avatarUrl }) {
    this.provider = provider;
    this.providerSub = providerSub;
    this.email = email.trim().toLowerCase();
    this.emailVerified = Boolean(emailVerified);
    this.name = name;
    this.avatarUrl = avatarUrl ?? null;
    Object.freeze(this);
  }
}
