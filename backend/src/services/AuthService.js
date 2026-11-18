import { UnauthorizedError } from '../models/errors.js';

/**
 * Single Responsibility: orchestrates OAuth 2.0 authentication flow and identity session issuance.
 * Depends on the abstract `OAuthProvider` contract (Dependency Inversion & Open/Closed Principles).
 */
export class AuthService {
  constructor({ oauthProvider, userRepository, rbacService, tokenService, adminEmails }) {
    this.oauthProvider = oauthProvider;
    this.userRepository = userRepository;
    this.rbacService = rbacService;
    this.tokenService = tokenService;
    this.adminEmails = adminEmails;
  }

  initiateLogin() {
    const state = this.tokenService.generateOAuthState();
    const { codeVerifier, codeChallenge } = this.tokenService.generatePkcePair();
    const authorizationUrl = this.oauthProvider.createAuthorizationUrl({
      state,
      codeChallenge,
    });

    return {
      authorizationUrl,
      state,
      codeVerifier,
    };
  }

  async handleCallback({ code, receivedState, expectedState, codeVerifier }) {
    if (!code) {
      throw new UnauthorizedError('Missing authorization code from OAuth provider');
    }

    if (!this.tokenService.verifyStateMatch(receivedState, expectedState)) {
      throw new UnauthorizedError('OAuth state validation failed (possible CSRF attack)');
    }

    if (!codeVerifier) {
      throw new UnauthorizedError('Missing PKCE code verifier cookie');
    }

    const profile = await this.oauthProvider.exchangeCodeForProfile({
      code,
      codeVerifier,
    });

    const user = await this.userRepository.upsertFromOAuthProfile(profile);
    await this.rbacService.bootstrapUserRole(user, this.adminEmails);

    const token = this.tokenService.signIdentityToken(user.id);
    const access = await this.rbacService.getUserAccessContext(user.id);

    return {
      token,
      user: {
        ...user.toDTO(),
        roles: access.roles,
        permissions: access.permissions,
      },
    };
  }

  async getCurrentUserProfile(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('Session user no longer exists. Please log in again.');
    }

    const access = await this.rbacService.getUserAccessContext(user.id);
    return {
      ...user.toDTO(),
      roles: access.roles,
      permissions: access.permissions,
    };
  }
}
