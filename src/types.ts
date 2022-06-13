import type {
  GitHubAppAuthentication,
  OAuthAppAuthentication,
} from "@octokit/auth-oauth-user";

import type {
  EndpointOptions,
  OctokitResponse,
  RequestInterface,
  RequestParameters,
  Route,
} from "@octokit/types";

// An `AuthStrategy` is a function that takes a single parameter of type
// `AuthStrategyOptions`  and returns an `Authenticator`. An `Authenticator` is
// also a function (with state of type `AuthenticatorState`) that takes an
// `AuthenticatorMethods` and returns an `Auth` with `token`.

export type ClientTypes = OAuthApp | GitHubApp;
export type OAuthApp = "oauth-app";
export type GitHubApp = "github-app";

/**
 * A generic version of `AuthInterface` defined in [@octokit/types.ts][1]
 * [1]: https://github.com/octokit/types.ts/blob/master/src/AuthInterface.ts
 *
 * > Interface to implement complex authentication strategies for Octokit.
 *   An object Implementing the AuthInterface can directly be passed as the
 *   `auth` option in the Octokit constructor.
 *
 * > For the official implementations of the most common authentication
 *   strategies, see https://github.com/octokit/auth.js
 */
export interface AuthStrategy<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> {
  (
    method?: AuthenticatorMethods<ClientType, ExpirationEnabled>,
  ): Promise<Auth<ClientType, ExpirationEnabled> | null>;

  hook<T = unknown>(
    request: RequestInterface,
    route: Route | EndpointOptions,
    parameters?: RequestParameters,
  ): Promise<OctokitResponse<T>>;
}

/**
 * Supported methods of a created client authentication strategy:
 *
 * 1. Get token
 * 2. [Sign in](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity)
 * 3. [Create an app token](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github)
 * 4. [Check a token](https://docs.github.com/en/rest/reference/apps#check-a-token)
 * 5. [Create a scoped access token](https://docs.github.com/en/rest/reference/apps#create-a-scoped-access-token)
 * 6. [Reset a token](https://docs.github.com/en/rest/reference/apps#reset-a-token)
 * 7. [Renewing a user token with a refresh token](https://docs.github.com/en/developers/apps/building-github-apps/refreshing-user-to-server-access-tokens#renewing-a-user-token-with-a-refresh-token)
 * 8. [Delete an app token](https://docs.github.com/en/rest/reference/apps#delete-an-app-token) (sign out)
 * 9. [Delete an app
 *    authorization](https://docs.github.com/en/rest/reference/apps#delete-an-app-authorization)
 */
export type AuthenticatorMethods<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> =
  | { type: "getToken" }
  | (
    & {
      type: "signIn";
      login?: string;
      allowSignup?: boolean;
    }
    & (ClientType extends OAuthApp ? { scopes?: string[] }
      : Record<never, never>)
  )
  | { type: "createToken" }
  | { type: "checkToken" }
  | (ClientType extends OAuthApp ? { type: "createScopedToken" } : never)
  | { type: "resetToken" }
  | (ExpirationEnabled extends true ? { type: "renewToken" } : never)
  | { type: "deleteToken"; offline?: boolean }
  | { type: "deleteAuthorization" };

/**
 * Authentication object returned from [`@octokit/oauth-app.js`][1].
 *
 * [1]: https://github.com/octokit/oauth-app.js
 */
export type Auth<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> =
  & (ExpirationEnabled extends true ? {
    expiresAt: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
  }
    : Record<never, never>)
  & Omit<
    (ClientType extends OAuthApp ? OAuthAppAuthentication
      : GitHubAppAuthentication),
    "clientSecret"
  >;

/**
 * State of an authenticator. Missing options have default values.
 */
export type AuthenticatorState<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> = Required<AuthStrategyOptions<ClientType, ExpirationEnabled>>;

/** Options to create an authenticator. */
export type AuthStrategyOptions<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> =
  & MandatoryAuthStrategyOptions<ClientType, ExpirationEnabled>
  & Partial<OptionalAuthStrategyOptions<ClientType, ExpirationEnabled>>;

/** Mandatory options to create an authenticator. */
type MandatoryAuthStrategyOptions<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> = {
  clientId: string;
  clientType: ClientType;
  expirationEnabled: ExpirationEnabled;
};

/** Optional options to create an authenticator. */
export type OptionalAuthStrategyOptions<
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
> = {
  // generic properties
  auth: Auth<ClientType, ExpirationEnabled> | null;
  authStore: Store<Auth<ClientType, ExpirationEnabled>> | false;
  defaultScopes: ClientType extends OAuthApp ? string[] : never;

  // non-generic properties
  location: Location;
  fetch: typeof fetch;
  serviceOrigin: string;
  servicePathPrefix: string;
  stateStore: Store<string> | false;
};

/**
 * Generic store to persist authentication object or oauth `state` for [web
 * application flow][1].
 *
 * [1]: https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow
 */
export type Store<T> = {
  get: () => T | null | Promise<T | null>;
  set: (value: T | null) => void | Promise<void>;
};

// TODO: making @octokit/oauth-authorization-url generic
export type OAuthAuthorizationUrlOptions<ClientType extends ClientTypes> =
  & {
    clientType: ClientType;
    clientId: string;
    allowSignup?: boolean;
    login?: string;
    redirectUrl?: string;
    state?: string;
    baseUrl?: string;
  }
  & (ClientType extends OAuthApp ? { scopes?: string | string[] }
    : Record<never, never>);

type OAuthAuthorizationUrlResult<ClientType extends ClientTypes> = {
  allowSignup: boolean;
  clientId: string;
  clientType: ClientType;
  login?: string;
  redirectUrl?: string;
  state: string;
  url: string;
} & (ClientType extends OAuthApp ? { scopes: string[] } : Record<never, never>);

export { oauthAuthorizationUrl } from "@octokit/oauth-authorization-url";
declare module "@octokit/oauth-authorization-url" {
  function oauthAuthorizationUrl<ClientType extends ClientTypes>(
    options: OAuthAuthorizationUrlOptions<ClientType>,
  ): OAuthAuthorizationUrlResult<ClientType>;
}
