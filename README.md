# auth-oauth-user-client.js

> OAuth user authentication without exposing client secret

[![@latest](https://img.shields.io/npm/v/@octokit/auth-oauth-user-client.svg)](https://www.npmjs.com/package/@octokit/auth-oauth-user-client)
[![Build Status](https://github.com/octokit/auth-oauth-user-client.js/workflows/Test/badge.svg)](https://github.com/octokit/auth-oauth-user-client.js/actions?query=workflow%3ATest+branch%3Amain)

<details>
<summary>Table of contents</summary>

<!-- toc -->

- [Backend service](#backend-service)
- [Standalone usage](#standalone-usage)
- [Usage with Octokit](#usage-with-octokit)
- [`createOAuthUserClientAuth(options)` or `new Octokit({auth})`](#createoauthuserclientauthoptions-or-new-octokitauth)
  - [Custom store](#custom-store)
  - [Custom request](#custom-request)
- [`auth(command)`](#authcommand)
- [Session object](#session-object)
  - [Authentication object](#authentication-object)
  - [OAuth APP authentication token](#oauth-app-authentication-token)
  - [GitHub APP user authentication token with expiring disabled](#github-app-user-authentication-token-with-expiring-disabled)
  - [GitHub APP user authentication token with expiring enabled](#github-app-user-authentication-token-with-expiring-enabled)
- [`auth.hook(request, route, parameters)` or `auth.hook(request, options)`](#authhookrequest-route-parameters-or-authhookrequest-options)
- [Contributing](#contributing)
- [License](#license)

<!-- tocstop -->

</details>

## Backend service

`auth-oauth-user-client.js` requires a backend service to function.
[`@octokit/oauth-app`](https://github.com/octokit/oauth-app.js) provides
compatible Node.js/Express.js/Cloudflare Worker middlewares to support
`auth-oauth-user-client.js`.

## Standalone usage

<table>
<tbody valign=top align=left>
<tr><th>

Browsers

</th><td width=100%>

Load `@octokit/auth-oauth-user-client` directly from [cdn.skypack.dev](https://cdn.skypack.dev)

```html
<script type="module">
  import { createOAuthUserClientAuth } from "https://cdn.skypack.dev/@octokit/auth-oauth-user-client";
</script>
```

</td></tr>
<tr><th>

Node

</th><td>

Install with `npm install @octokit/auth-oauth-user-client`

```js
const {
  createOAuthUserClientAuth,
} = require("@octokit/auth-oauth-user-client");
```

</td></tr>
</tbody>
</table>

```js
const auth = createOAuthUserClientAuth({
  clientId: "clientId123",
  clientType: "github-app", // defaults to `"oauth-app"`
  expirationEnabled: true, // defaults to `true` for GitHub App, `false` for OAuth App
});

// Get token from local session. Returns `null` when `code` or `state` search
// parameters is missing and no session can be fetched from [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
const session = await auth({ type: "getToken" });

// Use `signIn` command to redirect to GitHub when the user is not signed in.
if (!session) await auth({ type: "signIn" });
// `token` can be retrieved from a non-null `session`.
else console.log(session.authentication.token);
```

## Usage with Octokit

<table>
<tbody valign=top align=left>
<tr><th>

Browsers

</th><td width=100%>

Load `@octokit/auth-oauth-user-client` and [`@octokit/core`](https://github.com/octokit/core.js) (or core-compatible module) directly from [cdn.skypack.dev](https://cdn.skypack.dev)

```html
<script type="module">
  import { Octokit } from "https://cdn.skypack.dev/@octokit/core";
  import { createOAuthUserClientAuth } from "https://cdn.skypack.dev/@octokit/auth-oauth-user-client";
</script>
```

</td></tr>
<tr><th>

Node

</th><td>

Install with `npm install @octokit/core @octokit/auth-oauth-user-client`. Optionally replace `@octokit/core` with a compatible module

```js
const { Octokit } = require("@octokit/core");
const {
  createOAuthUserClientAuth,
} = require("@octokit/auth-oauth-user-client");
```

</td></tr>
</tbody>
</table>

```js
const octokit = new Octokit({
  authStrategy: createOAuthUserClientAuth,
  auth: {
    clientId: "clientId123",
    clientType: "github-app", // defaults to `"oauth-app"`
    expirationEnabled: true, // defaults to `true` for GitHub App, `false` for OAuth App
  },
});

const session = await octokit.auth();

// Use `signIn` command to redirect to GitHub when the user is not signed in.
if (!session) await octokit.auth({ type: "signIn" });
// Make GitHub API requests.
else {
  const { data } = await octokit.request("GET /user");
  console.log(data);
}
```

## `createOAuthUserClientAuth(options)` or `new Octokit({auth})`

The `createOAuthUserClientAuth` method accepts a single `options` object as argument:

| name                    | type                | description                                                                                                                                                                                             |
| :---------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`clientId`**          | `string`            | **`Required`**. Find **Client ID** on the app’s about page in settings.                                                                                                                                 |
| **`clientType`**        | `string`            | Either `"oauth-app"` or `"github-app"`. Defaults to `"oauth-app"`.                                                                                                                                      |
| **`expirationEnabled`** | `boolean`           | Defaults to `true` for GitHub App, `false` for OAuth App.                                                                                                                                               |
| **`session`**           | `object`            | Initial session, defaults to `null`. See [session object](#session-object).                                                                                                                             |
| **`defaultScopes`**     | `string`            | Only relevant for OAuth App. See [available scopes](https://docs.github.com/en/developers/apps/scopes-for-oauth-apps#available-scopes).                                                                 |
| **`serviceOrigin`**     | `string`            | Defaults to `location.origin`. Required only when the `@octokit/oauth-app` Node.js/Express.js/Cloudflare middleware is deployed at a different origin.                                                  |
| **`servicePathPrefix`** | `string`            | Defaults to `"/api/github/oauth"`. Required only when the `@octokit/oauth-app` Node.js/Express.js/Cloudflare middleware is created with custom `pathPrefix`.                                            |
| **`sessionStore`**      | `object` or `false` | Custom store to get/set [session object](#session-object), `false` to disable session persistence. See [custom store](#custom-store).                                                                   |
| **`stateStore`**        | `object` or `false` | Custom store to get/set [state string](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#parameters), `false` to disable state persistence.                         |
| **`request`**           | `function`          | You can pass in your own [`@octokit/request`](https://github.com/octokit/request.js) instance. For usage with enterprise, set `baseUrl` to the API root endpoint. See [custom request](#custom-request) |

### Custom store

By default, `auth-oauth-user-client.js` uses [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) to store JSON
serialized session object and state string.

Pass `sessionStore` or `stateStore` in `createOAuthUserClientAuth(options)` (or
`new Octokit({auth})`) to use your custom code to persist session or state.

For example:

```js
const sessionStore = {
  get: async() => { /* return local session or `null` when there is no session */ }
  set: async(session) => {
    if (session == null) { /* delete local session */ }
    else { /* create or update local session */ }
  }
}

const auth = createOAuthUserClientAuth({
  clientId: "clientId123",
  sessionStore
});
```

### Custom request

```js
const { request } = require("@octokit/request");
createOAuthAppAuth({
  clientId: "1234567890abcdef1234",
  request: request.defaults({
    baseUrl: "https://ghe.my-company.com/api/v3",
  }),
});
```

## `auth(command)`

The async `auth()` method returned by `createOAuthUserClientAuth(options)` accepts the following commands:

| Command                                                                                                                                                                                                                                      | `{type: }`              | Optional Arguments                                                                                                                                        |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Sign in](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity)                                                                                                           | `"signIn"`              | <ul><li><code>login: "user"</code></li><li><code>allowSignup: false</code></li><li><code>scopes: ["repo"]</code> (only relevant for OAuth Apps)</li></ul> |
| Get (local) token                                                                                                                                                                                                                            | `"getToken"`            | –                                                                                                                                                         |
| [Create an app token](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github)                                                                              | `"createToken"`         | –                                                                                                                                                         |
| [Check a token](https://docs.github.com/en/rest/reference/apps#check-a-token)                                                                                                                                                                | `"checkToken"`          | –                                                                                                                                                         |
| [Create a scoped access token](https://docs.github.com/en/rest/reference/apps#create-a-scoped-access-token) (for OAuth App)                                                                                                                  | `"createScopedToken"`   | –                                                                                                                                                         |
| [Reset a token](https://docs.github.com/en/rest/reference/apps#reset-a-token)                                                                                                                                                                | `"resetToken"`          | –                                                                                                                                                         |
| [Renewing a user token with a refresh token](https://docs.github.com/en/developers/apps/building-github-apps/reshing-user-to-server-access-tokens#renewing-a-user-token-with-a-refresh-token) (for GitHub App with token expiration enabled) | `"refreshToken"`        | –                                                                                                                                                         |
| [Delete an app token](https://docs.github.com/en/rest/reference/apps#delete-an-app-token) (sign out)                                                                                                                                         | `"deleteToken"`         | `offline: true` (only deletes session from local session store)                                                                                           |
| [Delete an app authorization](https://docs.github.com/en/rest/reference/apps#delete-an-app-authorization)                                                                                                                                    | `"deleteAuthorization"` | –                                                                                                                                                         |

## Session object

The async `auth(options)` method resolves to an object with the following properties:

| property             | type     | description                                         |
| :------------------- | :------- | :-------------------------------------------------- |
| **`authentication`** | `object` | See [authentication object](#authentication-object) |

### Authentication object

There are three possible types of authentication object:

1. [OAuth APP authentication token](#oauth-app-authentication-token)
2. [GitHub APP user authentication token with expiring disabled](#github-app-user-authentication-token-with-expiring-disabled)
3. [GitHub APP user authentication token with expiring enabled](#github-app-user-authentication-token-with-expiring-enabled)

The differences are

1. `scopes` is only present for OAuth Apps
2. `refreshToken`, `expiresAt`, `refreshTokenExpiresAt` are only present for GitHub Apps, and only if token expiration is enabled

### OAuth APP authentication token

| name             | type               | description                                |
| :--------------- | :----------------- | :----------------------------------------- |
| **`type`**       | `string`           | `"token"`                                  |
| **`tokenType`**  | `string`           | `"oauth"`                                  |
| **`clientType`** | `string`           | `"oauth-app"`                              |
| **`clientId`**   | `string`           | The `clientId` from the strategy options   |
| **`token`**      | `string`           | The user access token                      |
| **`scopes`**     | `array of strings` | array of scope names enabled for the token |

### GitHub APP user authentication token with expiring disabled

| name             | type     | description                              |
| :--------------- | :------- | :--------------------------------------- |
| **`type`**       | `string` | `"token"`                                |
| **`tokenType`**  | `string` | `"oauth"`                                |
| **`clientType`** | `string` | `"github-app"`                           |
| **`clientId`**   | `string` | The `clientId` from the strategy options |
| **`token`**      | `string` | The user access token                    |

### GitHub APP user authentication token with expiring enabled

| name                        | type     | description                                                                                                                                                                  |
| :-------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`type`**                  | `string` | `"token"`                                                                                                                                                                    |
| **`tokenType`**             | `string` | `"oauth"`                                                                                                                                                                    |
| **`clientType`**            | `string` | `"github-app"`                                                                                                                                                               |
| **`clientId`**              | `string` | The `clientId` from the strategy options                                                                                                                                     |
| **`token`**                 | `string` | The user access token                                                                                                                                                        |
| **`refreshToken`**          | `string` | The refresh token                                                                                                                                                            |
| **`expiresAt`**             | `string` | Date timestamp in [ISO 8601](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString) standard. Example: `2022-01-01T08:00:0.000Z` |
| **`refreshTokenExpiresAt`** | `string` | Date timestamp in [ISO 8601](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString) standard. Example: `2022-01-01T08:00:0.000Z` |

## `auth.hook(request, route, parameters)` or `auth.hook(request, options)`

`auth.hook()` hooks directly into the request life cycle. It amends the request to authenticate correctly based on the request URL.

The `request` option is an instance of [`@octokit/request`](https://github.com/octokit/request.js#readme). The `route`/`options` parameters are the same as for the [`request()` method](https://github.com/octokit/request.js#request).

`auth.hook()` can be called directly to send an authenticated request

```js
const { data: user } = await auth.hook(request, "GET /user");
```

Or it can be passed as option to [`request()`](https://github.com/octokit/request.js#request).

```js
const requestWithAuth = request.defaults({ request: { hook: auth.hook } });
const { data: user } = await requestWithAuth("GET /user");
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE)
