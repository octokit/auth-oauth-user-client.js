import { request } from "@octokit/request";
import { VERSION, userAgent } from "./metadata";
import { auth } from "./auth";
import { hook } from "./hook";

import { createStore } from "./create-store";
import {
  ClientType,
  OAuthApp,
  GitHubApp,
  ExpirationType,
  ExpirationDisabled,
  ExpirationEnabled,
  StrategyOptions,
  AuthInterface,
  NonGenericState,
  GenericState,
  Session,
} from "./types";
import errors from "./errors";

// Create an OAuth strategy:
//
// 1. `clientType` defaults to `oauth-app`.
// 2. `expirationEnabled` defaults to `true` for GitHub App.
export function createOAuthUserClientAuth<
  Client extends ClientType = OAuthApp,
  Expiration extends ExpirationType = Client extends GitHubApp
    ? ExpirationEnabled
    : ExpirationDisabled
>({
  clientType = "oauth-app" as Client,
  expirationEnabled = (clientType === "github-app") as Expiration,
  ...options
}: StrategyOptions<Client, Expiration>): AuthInterface<Client, Expiration> {
  // Delete me once OAuth App supports token expiration.
  if (clientType === "oauth-app" && expirationEnabled)
    throw errors.oauthAppDoesNotSupportTokenExpiration;

  const defaultGenericState: GenericState<Client, Expiration> = Object.assign(
    {
      clientType,
      expirationEnabled,
      sessionStore: createStore<Session<Client, Expiration>>(
        `AUTH:${options.clientId}`
      ),
      session: null,
    },
    (clientType === "oauth-app" ? { defaultScopes: [] } : {}) as any
  );

  const defaultNonGenericState: NonGenericState = {
    serviceOrigin: location.origin,
    servicePathPrefix: "/api/github/oauth",
    request: request.defaults({ headers: { "user-agent": userAgent } }),
    stateStore: createStore(`STATE:${options.clientId}`),
  };

  const state = Object.assign(
    defaultGenericState,
    defaultNonGenericState,
    options
  );

  return Object.assign(auth.bind(state), { hook: hook.bind(state) });
}

createOAuthUserClientAuth.VERSION = VERSION;
