import { endpoints } from "./endpoints.ts";
import { fetchOAuthApp } from "./fetch-oauth-app.ts";
import type {
  Auth,
  AuthenticatorMethods,
  AuthenticatorState,
  ClientTypes,
  OAuthAuthorizationUrlOptions,
} from "./types.ts";
import { oauthAuthorizationUrl } from "@octokit/oauth-authorization-url";

export const auth = <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
>(
  state: AuthenticatorState<ClientType, ExpirationEnabled>,
) => {
  type Command = AuthenticatorMethods<ClientType, ExpirationEnabled>;
  const authStore = state.authStore || undefined;
  const stateStore = state.stateStore || undefined;

  const fetchAuth = async (
    type: keyof typeof endpoints,
    token: string | null,
    body: Record<string, unknown> | null,
  ) => {
    let auth = (await fetchOAuthApp(state, type, token, body))
      ?.authentication || null;
    if (auth) auth = { ...(state.auth || {}), ...auth };
    return await setAuth(auth);
  };

  const setAuth = async (
    auth: Auth<ClientType, ExpirationEnabled> | null = null,
  ) => {
    await authStore?.set(auth);
    return (state.auth = auth);
  };

  return async function auth(
    command: Command = { type: "getToken" },
  ): Promise<Auth<ClientType, ExpirationEnabled> | null> {
    const { type, ...commandOptions } = command;

    const url = new URL(state.location.href);
    const code = url.searchParams.get("code");
    const newState = url.searchParams.get("state");

    switch (type) {
      case "signIn": {
        await setAuth(); // clear local auth before redirecting
        const newState = Math.random().toString(36).substring(2);
        stateStore?.set(newState);
        const redirectUrl = oauthAuthorizationUrl<ClientType>({
          clientType: state.clientType,
          clientId: state.clientId,
          redirectUrl: state.location.href,
          state: newState,
          ...commandOptions,
        } as OAuthAuthorizationUrlOptions<ClientType>).url;
        state.location.href = redirectUrl;
        return null;
      }

      case "getToken": {
        if (!code || !newState) {
          state.auth ||= (await authStore?.get()) || null;
          if (!state.auth) return null;
          if (
            // @ts-ignore better than a one-time assertion function
            !state.auth.expiresAt || new Date(state.auth.expiresAt) > new Date()
          ) {
            return state.auth;
          }
          return await auth({ type: "renewToken" } as Command);
        }
      }

      /* falls through */

      case "createToken": {
        if (!code || !newState) {
          throw Error('Both "code" & "state" parameters are required.');
        }
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        const redirectUrl = url.href;
        // @ts-ignore mock `window.history` in tests
        window.history.replaceState({}, "", redirectUrl);
        const oldState = (await stateStore?.get());
        await stateStore?.set(null);
        if (stateStore && (newState != oldState)) {
          throw Error("State mismatch.");
        }
        return await fetchAuth("createToken", null, {
          state: newState, // TODO: this is unnecessary, update oauth-app
          code,
          redirectUrl,
        });
      }

      case "checkToken":
      case "createScopedToken":
      case "resetToken":
      case "renewToken":
      case "deleteToken":
      case "deleteAuthorization": {
        let body: Record<string, unknown> | null = null;
        if (["POST", "PUT", "PATCH"].includes(endpoints[type]?.[0])) {
          const { type: _, ..._payload } = command as Record<string, unknown>;
          body = _payload;
        }
        if (type === "deleteToken" && command.offline) return await setAuth();
        if (type === "renewToken") {
          if (state.auth) {
            const auth = state.auth as Auth<ClientType, true>;
            const renewableUntil = new Date(auth.refreshTokenExpiresAt);
            if (new Date() > renewableUntil) return await setAuth();
            body!.refreshToken = auth.refreshToken;
          }
        } else state.auth = await auth();
        if (!state.auth) throw Error("Unauthorized.");
        const { token } = state.auth; // TODO: does `renewToken` need token?
        if (type.startsWith("delete")) await setAuth();
        return await fetchAuth(type, token, body);
      }
    }
  };
};
