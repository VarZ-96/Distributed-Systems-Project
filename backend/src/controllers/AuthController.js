/**
 * Thin HTTP adapter for OAuth 2.0 login, callback, logout, and identity introspection.
 * Delegates all business logic to AuthService.
 */
export class AuthController {
  constructor({ authService, config }) {
    this.authService = authService;
    this.config = config;
  }

  login = (_req, res, next) => {
    try {
      const { authorizationUrl, state, codeVerifier } = this.authService.initiateLogin();
      const oauthCookieOptions = this.#oauthFlowCookieOptions();

      res.cookie(this.config.cookies.oauthStateName, state, oauthCookieOptions);
      res.cookie(this.config.cookies.oauthPkceName, codeVerifier, oauthCookieOptions);

      return res.redirect(302, authorizationUrl);
    } catch (error) {
      return next(error);
    }
  };

  callback = async (req, res) => {
    const oauthCookieOptions = this.#oauthFlowCookieOptions();
    const expectedState = req.cookies?.[this.config.cookies.oauthStateName];
    const codeVerifier = req.cookies?.[this.config.cookies.oauthPkceName];

    // Single-use OAuth flow cookies: clear immediately regardless of outcome
    res.clearCookie(this.config.cookies.oauthStateName, oauthCookieOptions);
    res.clearCookie(this.config.cookies.oauthPkceName, oauthCookieOptions);

    if (req.query.error) {
      return res.redirect(302, `${this.config.frontendUrl}/?auth_error=oauth_cancelled`);
    }

    try {
      const { token } = await this.authService.handleCallback({
        code: typeof req.query.code === 'string' ? req.query.code : '',
        receivedState: typeof req.query.state === 'string' ? req.query.state : '',
        expectedState,
        codeVerifier,
      });

      res.cookie(this.config.cookies.authTokenName, token, this.#authCookieOptions());
      return res.redirect(302, `${this.config.frontendUrl}/`);
    } catch (error) {
      console.warn('[AuthController] OAuth callback failed:', error.message);
      return res.redirect(302, `${this.config.frontendUrl}/?auth_error=oauth_failed`);
    }
  };

  logout = (_req, res) => {
    res.clearCookie(this.config.cookies.authTokenName, this.#authCookieOptions());
    return res.status(200).json({
      message: 'Logged out successfully',
    });
  };

  me = async (req, res, next) => {
    try {
      const profile = await this.authService.getCurrentUserProfile(req.userId);
      return res.status(200).json({ user: profile });
    } catch (error) {
      return next(error);
    }
  };

  #oauthFlowCookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.cookies.secure,
      sameSite: this.config.cookies.sameSite,
      maxAge: this.config.cookies.oauthFlowMaxAgeMs,
      path: '/auth/google/callback',
    };
  }

  #authCookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.cookies.secure,
      sameSite: this.config.cookies.sameSite,
      maxAge: this.config.cookies.authMaxAgeMs,
      path: '/',
    };
  }
}
