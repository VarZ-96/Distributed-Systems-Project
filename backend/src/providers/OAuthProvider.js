/**
 * Strategy Pattern (Open/Closed Principle):
 * Abstract contract for any OAuth 2.0 / OIDC identity provider.
 * Adding GitHub, Microsoft, or Okta requires implementing this class
 * with zero changes to AuthService or AuthController.
 */
export class OAuthProvider {
  constructor() {
    if (new.target === OAuthProvider) {
      throw new Error('OAuthProvider is an abstract class and cannot be instantiated directly');
    }
  }

  get providerName() {
    throw new Error('Subclasses must implement getter providerName');
  }

  /**
   * Builds the provider authorization URL with CSRF `state` and PKCE `codeChallenge`.
   * @param {{ state: string, codeChallenge: string }} _params
   * @returns {string}
   */
  createAuthorizationUrl(_params) {
    throw new Error('Subclasses must implement createAuthorizationUrl({ state, codeChallenge })');
  }

  /**
   * Exchanges an authorization code + PKCE verifier for a cryptographically verified AuthProfile.
   * @param {{ code: string, codeVerifier: string }} _params
   * @returns {Promise<import('../models/entities.js').AuthProfile>}
   */
  async exchangeCodeForProfile(_params) {
    throw new Error('Subclasses must implement exchangeCodeForProfile({ code, codeVerifier })');
  }
}
