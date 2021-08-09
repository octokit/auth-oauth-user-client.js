import * as OctokitTypes from "@octokit/types";
import * as AuthOAuthUser from "@octokit/auth-oauth-user";

// # Types of Generic Parameters

// Most types and interfaces are generic around two types:
//
// 1. Client type: If it’s an OAuth App or a GitHub App.
// 2. Expiration setting: If token expiration has been enabled for the app.
//
// Although currently GitHub does not support token expiration for OAuth app,
// expiring OAuth tokens will become the norm in future. These two concepts are
// modeled orthogonally.
export type ClientType = OAuthApp | GitHubApp;
export type OAuthApp = "oauth-app";
export type GitHubApp = "github-app";

export type ExpirationType = ExpirationEnabled | ExpirationDisabled;
export type ExpirationDisabled = false;
export type ExpirationEnabled = true;

// # Session

// Generic session type.
export type Session<
  Client extends ClientType,
  Expiration extends ExpirationType
> = {
  authentication: Client extends OAuthApp
    ? Expiration extends ExpirationDisabled
      ? Omit<AuthOAuthUser.OAuthAppAuthentication, "clientSecret">
      : never
    : Expiration extends ExpirationDisabled
    ? Omit<AuthOAuthUser.GitHubAppAuthentication, "clientSecret">
    : Omit<AuthOAuthUser.GitHubAppAuthenticationWithExpiration, "clientSecret">;
};

// # Internal State

// `clientId` is necessary for the `signIn` command to redirect only once
// (without relying on a `/api/github/oauth/login` endpoint.) `clientId` is
// public information which is exposed in the first step of the [web application
// OAuth flow](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow)
export type RequiredOptions = { clientId: string };

// Generic state properties related to client types and expiration settings.
export type GenericState<
  Client extends ClientType,
  Expiration extends ExpirationType
> = {
  clientType: Client;
  expirationEnabled: Expiration;
  sessionStore: false | Store<Session<Client, Expiration>>;
  session: Session<Client, Expiration> | null;
  defaultScopes: Client extends OAuthApp ? string[] : never;
};

// Non-generic state properties for all types of apps and expiration settings.
export type NonGenericState = {
  serviceOrigin: string; // Protocol, hostname, and port of backend services.
  servicePathPrefix: string; // Path prefix of backend services.
  stateStore: Store<string> | false;
  request: OctokitTypes.RequestInterface;
};

// Store for persisting authentication or [oauth `state` for web application
// flow](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow).
export type Store<Value> = {
  get: () => Promise<Value | null>;
  set: (value?: Value | null) => Promise<void>;
};

// All properties in the internal state are non-optional although most of them
// are optional in the strategy options.
export type State<
  Client extends ClientType,
  Expiration extends ExpirationType
> = RequiredOptions & GenericState<Client, Expiration> & NonGenericState;

// Most properties are optional in strategy options.
export type StrategyOptions<
  Client extends ClientType,
  Expiration extends ExpirationType
> = RequiredOptions &
  Partial<GenericState<Client, Expiration>> &
  Partial<NonGenericState>;

// # Interface

// Supported commands of a created authentication strategy. Types are named
// using a `verb` + `noun` pattern (such as `refreshToken`) matching the
// documentation title.
//
// 1. [Sign in](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity)
// 2. Get (local) token
// 3. [Create an app token](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github)
// 4. [Check a token](https://docs.github.com/en/rest/reference/apps#check-a-token)
// 5. [Create a scoped access token](https://docs.github.com/en/rest/reference/apps#create-a-scoped-access-token)
// 6. [Reset a token](https://docs.github.com/en/rest/reference/apps#reset-a-token)
// 7. [Renewing a user token with a refresh token](https://docs.github.com/en/developers/apps/building-github-apps/refreshing-user-to-server-access-tokens#renewing-a-user-token-with-a-refresh-token)
// 8. [Delete an app token](https://docs.github.com/en/rest/reference/apps#delete-an-app-token) (sign out)
// 9. [Delete an app authorization](https://docs.github.com/en/rest/reference/apps#delete-an-app-authorization)
export type Command<
  Client extends ClientType,
  Expiration extends ExpirationType
> =
  | {
      type: "signIn";
      login?: string;
      allowSignup?: boolean;
      scopes?: Client extends OAuthApp ? string[] : never;
    }
  | { type: "getToken" }
  | { type: "createToken" }
  | { type: "checkToken" }
  | (Client extends GitHubApp ? { type: "createScopedToken" } : never)
  | { type: "resetToken" }
  | (Expiration extends ExpirationEnabled ? { type: "refreshToken" } : never)
  | { type: "deleteToken"; offline?: boolean }
  | { type: "deleteAuthorization" };

// Authentication strategy created via `createOAuthUserClientAuth`.
export interface AuthInterface<
  Client extends ClientType,
  Expiration extends ExpirationType
> {
  (options?: Command<Client, Expiration>): Promise<Session<
    Client,
    Expiration
  > | null>;

  hook(
    request: OctokitTypes.RequestInterface,
    route: OctokitTypes.Route | OctokitTypes.EndpointOptions,
    parameters?: OctokitTypes.RequestParameters
  ): Promise<OctokitTypes.OctokitResponse<any>>;
}
