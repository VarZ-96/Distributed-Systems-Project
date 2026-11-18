import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url('GOOGLE_REDIRECT_URI must be a valid URL'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for cryptographic strength'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_ISSUER: z.string().min(1).default('oauth-rbac-demo'),
  JWT_AUDIENCE: z.string().min(1).default('oauth-rbac-demo-client'),
  ADMIN_EMAILS: z.string().optional().default(''),
});

/**
 * Centralized, validated, immutable application configuration.
 * Fails fast at process startup if any required secret or setting is missing or invalid.
 */
export class AppConfig {
  constructor(rawEnv = process.env) {
    const parsed = envSchema.safeParse(rawEnv);

    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }

    const env = parsed.data;

    this.nodeEnv = env.NODE_ENV;
    this.isProduction = env.NODE_ENV === 'production';
    this.port = env.PORT;
    this.frontendUrl = env.FRONTEND_URL.replace(/\/+$/, '');
    this.databaseUrl = env.DATABASE_URL;

    this.google = Object.freeze({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    });

    this.jwt = Object.freeze({
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    this.cookies = Object.freeze({
      authTokenName: 'auth_token',
      oauthStateName: 'oauth_state',
      oauthPkceName: 'oauth_pkce_verifier',
      authMaxAgeMs: 60 * 60 * 1000, // 1 hour
      oauthFlowMaxAgeMs: 10 * 60 * 1000, // 10 minutes
      secure: this.isProduction,
      sameSite: 'lax',
    });

    this.adminEmails = new Set(
      env.ADMIN_EMAILS.split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    );

    Object.freeze(this);
  }
}
