/// <reference lib="dom" />
import { auth } from "./auth.ts";
import { createStore } from "./create-store.ts";
import { hook } from "./hook.ts";
import type {
  AuthStrategy,
  AuthStrategyOptions,
  ClientTypes,
  OptionalAuthStrategyOptions,
} from "./types.ts";

export const createOAuthUserClientAuth = <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
>(
  options: AuthStrategyOptions<ClientType, ExpirationEnabled>,
): AuthStrategy<
  ClientType,
  ExpirationEnabled
> => {
  if (options.clientType === "oauth-app" && options.expirationEnabled) {
    throw Error("OAuth App does not support token expiration.");
  }

  const defaultOptions = {
    authStore: createStore(`AUTH:${options.clientId}`),
    stateStore: createStore(`STATE:${options.clientId}`),
    auth: null,
    ...(options.clientType === "oauth-app"
      ? { defaultScopes: [] as string[] }
      : {}),
    serviceOrigin: location.origin,
    servicePathPrefix: "/api/github/oauth",
    location,
    fetch,
  } as OptionalAuthStrategyOptions<ClientType, ExpirationEnabled>;

  const state = { ...defaultOptions, ...options };
  if (options.auth && state.authStore) state.authStore.set(options.auth);
  const _auth = auth(state);
  return Object.assign(_auth, { hook: hook(_auth) });
};
