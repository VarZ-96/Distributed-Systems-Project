import { OAuth2Client } from 'google-auth-library';
import { AuthProfile } from '../models/entities.js';
import { UnauthorizedError } from '../models/errors.js';
import { OAuthProvider } from './OAuthProvider.js';

/**
 * Concrete Google OAuth 2.0 + OIDC provider using Authorization Code Flow with PKCE.
 * Cryptographically verifies Google's ID token and keys identity by immutable `sub`.
 */
export class GoogleOAuthProvider extends OAuthProvider {
  constructor({ clientId, clientSecret, redirectUri }) {
    super();
    this.clientId = clientId;
    this.oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  get providerName() {
    return 'google';
  }

  createAuthorizationUrl({ state, codeChallenge }) {
    return this.oauthClient.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  }

  async exchangeCodeForProfile({ code, codeVerifier }) {
    let tokens;
    try {
      const tokenResponse = await this.oauthClient.getToken({
        code,
        codeVerifier,
      });
      tokens = tokenResponse.tokens;
    } catch {
      throw new UnauthorizedError('Failed to exchange authorization code with Google');
    }

    if (!tokens?.id_token) {
      throw new UnauthorizedError('Google OAuth response did not contain an ID token');
    }

    let payload;
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedError('Invalid or untrusted Google ID token');
    }

    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedError('Google ID token is missing required identity claims');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedError('Google account email is not verified');
    }

    return new AuthProfile({
      provider: this.providerName,
      providerSub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name || payload.email.split('@')[0],
      avatarUrl: payload.picture || null,
    });
  }
}
