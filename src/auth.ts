import {
  getWebFlowAuthorizationUrl,
  GetWebFlowAuthorizationUrlOptions,
} from "./get-web-flow-authorization-url";
import errors from "./errors";
import { ClientType, ExpirationType, Session, State, Command } from "./types";

const oauthAppEndpoints = {
  createToken: "POST /token",
  checkToken: "GET /token",
  createScopedToken: "POST /token/scoped",
  resetToken: "PATCH /token",
  refreshToken: "PATCH /refresh-token",
  deleteToken: "DELETE /token",
  deleteAuthorization: "DELETE /grant",
};

export async function auth<
  Client extends ClientType,
  Expiration extends ExpirationType
>(
  this: State<Client, Expiration>,
  command: Command<Client, Expiration> = { type: "getToken" }
): Promise<Session<Client, Expiration> | null> {
  // Send `payload` to the `@octokit/oauth-app` endpoint matching `command`.
  const payload: any = {};
  const requestOAuthApp = async (
    command: keyof typeof oauthAppEndpoints,
    session: Session<Client, Expiration> | null
  ) => {
    const [method, path] = oauthAppEndpoints[command].split(" ");
    const options = Object.assign({ method, headers: {} }, payload);
    const token = session?.authentication.token;
    if (token) options.headers.authorization = "token " + token;
    const route = this.serviceOrigin + this.servicePathPrefix + path;
    return await this.request(route, options);
  };

  switch (command.type) {
    // Clear local session and redirect to web flow authorization url.
    case "signIn": {
      this.session = null;
      if (this.sessionStore) await this.sessionStore.set(null);
      const oauthState = Math.random().toString(36).substr(2);
      if (this.stateStore) this.stateStore.set(oauthState);

      const options = {
        clientType: this.clientType,
        clientId: this.clientId,
        request: this.request,
        redirectUrl: location.href,
        state: oauthState,
        login: command.login,
        allowSignup: command.allowSignup,
      } as GetWebFlowAuthorizationUrlOptions<Client>;

      if (options.clientType === "oauth-app") {
        options.scopes = command.scopes ?? this.defaultScopes;
      }

      const { url } = getWebFlowAuthorizationUrl(options);
      location.href = url;
      return null;
    }

    // Unless both `code` and `state` search parameters are present, returns
    // session from internal state, fail over to session store when internal
    // state has no session.
    case "getToken": {
      const url = new URL(location.href);
      const code = url.searchParams.get("code");
      const receivedState = url.searchParams.get("state");
      if (!code || !receivedState) {
        if (this.sessionStore) this.session ??= await this.sessionStore.get();
        if (!this.session) return null;
        if (!("expiresAt" in this.session.authentication)) return this.session;
        // Auto refresh for user-to-server token.
        const expiresAt = this.session.authentication.expiresAt;
        if (new Date(expiresAt) > new Date()) return this.session;
        return await auth.call(this, { type: "refreshToken" } as Command<
          Client,
          Expiration
        >);
      }
    }

    // Exchange `code` parameter for an session using backend service.
    case "createToken": {
      const url = new URL(location.href);
      const code = url.searchParams.get("code");
      const receivedState = url.searchParams.get("state");
      if (!code || !receivedState) throw errors.codeOrStateMissing;

      // Received `state` must match provided.
      if (this.stateStore) {
        const providedState = await this.stateStore.get();
        await this.stateStore.set(null);
        if (receivedState !== providedState) throw errors.stateMismatch;
      }

      // Remove `code` and `state` query parameters from url.
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      const redirectUrl = url.href;
      history.replaceState({}, "", redirectUrl);

      // Always fallthrough as `createToken` (not `getToken`).
      command.type = "createToken";
      Object.assign(payload, { code, redirectUrl, state: receivedState });
    }

    case "checkToken":
    case "createScopedToken":
    case "resetToken":
    case "refreshToken":
    case "deleteToken":
    case "deleteAuthorization": {
      // `createToken` doesn’t need a token while the others do.
      if (command.type !== "createToken") {
        this.session ||= await auth.call(this);
        if (!this.session) throw errors.unauthorized;
      }
      const oldSession = this.session;

      // Prepare payload for `refreshToken` command.
      if (this.session && "refreshToken" in this.session.authentication) {
        const refreshToken = this.session.authentication.refreshToken;
        Object.assign(payload, { refreshToken });
      }

      if (command.type === "deleteToken" && command.offline) {
        this.session = null;
      } else {
        // Invoke `@octokit/oauth-app` endpoint and replace local session.
        const response = await requestOAuthApp(command.type, this.session);
        this.session = response.data || null;
      }

      // Some `oauth-app.js` endpoints (such as `resetToken`) do not (and can
      // not) return `refreshToken`. Original `refreshToken` and
      // `refreshTokenExpiresAt` are kept to `refreshToken` later.
      if (oldSession && "refreshToken" in oldSession.authentication) {
        if (this.session && !("refreshToken" in this.session.authentication))
          Object.assign(this.session.authentication, {
            refreshToken: oldSession.authentication.refreshToken,
            refreshTokenExpiresAt:
              oldSession.authentication.refreshTokenExpiresAt,
          });
      }

      if (this.sessionStore) await this.sessionStore.set(this.session);
      return this.session;
    }
  }
}
