import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../models/errors.js';

/**
 * Single Responsibility: cryptographic token & OAuth PKCE/state operations.
 * Issues strictly IDENTITY-ONLY JWTs (`sub: user.id`) — never embeds roles or permissions.
 */
export class TokenService {
  constructor({ secret, expiresIn, issuer, audience }) {
    this.secret = secret;
    this.expiresIn = expiresIn;
    this.issuer = issuer;
    this.audience = audience;
  }

  /**
   * Signs an identity-only JWT containing ONLY the local user ID in `sub`.
   * Roles and permissions are intentionally excluded so RBAC changes apply immediately.
   */
  signIdentityToken(userId) {
    return jwt.sign({}, this.secret, {
      algorithm: 'HS256',
      subject: String(userId),
      issuer: this.issuer,
      audience: this.audience,
      expiresIn: this.expiresIn,
    });
  }

  /**
   * Cryptographically verifies the JWT with algorithm pinning (`HS256`) and strict claims.
   * @returns {{ userId: string }}
   */
  verifyIdentityToken(token) {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Missing authentication token');
    }

    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      });

      if (!payload || typeof payload !== 'object' || typeof payload.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedError('Malformed authentication token');
      }

      return { userId: payload.sub };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError('Invalid or expired authentication token');
    }
  }

  generateOAuthState() {
    return crypto.randomBytes(32).toString('base64url');
  }

  generatePkcePair() {
    const codeVerifier = crypto.randomBytes(48).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  verifyStateMatch(receivedState, expectedState) {
    if (!receivedState || !expectedState) {
      return false;
    }
    const receivedBuf = Buffer.from(String(receivedState), 'utf8');
    const expectedBuf = Buffer.from(String(expectedState), 'utf8');
    if (receivedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(receivedBuf, expectedBuf);
  }
}
