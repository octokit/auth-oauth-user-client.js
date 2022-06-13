# auth-oauth-user-client.js

Authentication strategy for Octokit without exposing client secret.

## Backend service

`auth-oauth-user-client.js` requires a backend service to function.
[`@octokit/oauth-app`](https://github.com/octokit/oauth-app.js) provides the
compatible Node.js/Express.js/Cloudflare Worker/Deno middlewares to interact
with `auth-oauth-user-client.js`.

## Browsers

Load directly from CDNs:

- jsdelivr:
  `https://cdn.jsdelivr.net/gh/octokit/auth-oauth-user-client.js@v0.1.0/dist/index.min.js`

```html
<script type="module">
  import { createOAuthUserClientAuth } from "https://cdn.jsdelivr.net/gh/octokit/auth-oauth-user-client.js@v0.1.0/dist/index.min.js";
</script>
```

## Create An Authenticator Instance

```js
const authenticator = createOAuthUserClientAuth({
  clientId: "client_id", // get client id from https://github.com/settings/apps
  clientType: "github-app", // "github-app" | "oauth-app"
  expirationEnabled: true, // true | false
});
```

## Get Token

Use `{ type: "getToken" }` method to get authentication object from
[`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
Returns `null` when there is no authentication object found in `localStorage`.

When both `code` and `state` search parameters are present (user being
redirected from GitHub login url), `"getToken"` method will automatically
exchange the `code` search parameter for an authentication object using the
[backend service](#backend-service).

```js
const auth = await authenticator(); // ≡ ({ type: "getToken" })
```

## Sign In

Use `signIn` method to clear authentication object from `localStorage` and
redirect user to GitHub login url.

```js
if (!auth) await authenticator({ type: "signIn" });
```

## All Methods

| `{ type: ? }`           | Meaning                                           | Note                                                                                                                                                                                            |
| :---------------------- | :------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"getToken"`            | Get token                                         | See [Get token](#get-token).                                                                                                                                                                    |
| `"signIn"`              | [Sign in][m1]                                     | See [Sign in](#sign-in).                                                                                                                                                                        |
| `"createToken"`         | [Exchange `code` in url parameters for token][m2] | Normally the `getToken` method will exchange `code` for an access token automatically when both `code` and `state` search parameters are present (user being redirected from GitHub login url). |
| `"checkToken"`          | [Check a token][m3]                               | —                                                                                                                                                                                               |
| `"createScopedToken"`   | [Create a scoped access token][m4]                | For OAuth app only. Specify extra parameters like `{ type: "createScopedToken", target: ... }`.                                                                                                 |
| `"resetToken"`          | [Reset a token][m5]                               | —                                                                                                                                                                                               |
| `"renewToken"`          | [Renewing a user token with a refresh token][m6]  | The app should enable token expiration in settings (GitHub App only currently)                                                                                                                  |
| `"deleteToken"`         | [Delete an app token][m7]                         | Use `{ type = "deleteToken", offline: true }` to delete authentication from `localStorage` without calling GitHub API via backend service.                                                      |
| `"deleteAuthorization"` | [Delete an app authorization][m8]                 |                                                                                                                                                                                                 |

[m1]: https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity
[m2]: https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
[m3]: https://docs.github.com/en/rest/reference/apps#check-a-token
[m4]: https://docs.github.com/en/rest/reference/apps#create-a-scoped-access-token
[m5]: https://docs.github.com/en/rest/reference/apps#reset-a-token
[m6]: https://docs.github.com/en/developers/apps/building-github-apps/refreshing-user-to-server-access-tokens#renewing-a-user-token-with-a-refresh-token
[m7]: https://docs.github.com/en/rest/reference/apps#delete-an-app-token
[m8]: https://docs.github.com/en/rest/reference/apps#delete-an-app-authorization

## Usage with Octokit

To use `@octokit/auth-oauth-user-client` with
[`@octokit/core`](https://github.com/octokit/core.js)-compatible
modules, specify the authentication strategy and authentication strategy
options.

```html
<script type="module">
  import { Octokit } from "https://cdn.skypack.dev/@octokit/octokit";
  import { createOAuthUserClientAuth } from "https://cdn.jsdelivr.net/gh/octokit/auth-oauth-user-client.js@v0.1.0/dist/index.min.js";

  const octokit = new Octokit({
    authStrategy: createOAuthUserClientAuth,
    auth: {
      clientId: "client_id", // get client id from https://github.com/settings/apps
      clientType: "github-app", // "github-app" | "oauth-app"
      expirationEnabled: true, // true | false
    },
  });

  const auth = await octokit.auth();
  if (!auth) await octokit.auth({ type: "signIn" });
  else console.log(await octokit.rest.users.getAuthenticated());
</script>
```

Or

```html
<script type="module">
  import { Octokit } from "https://cdn.skypack.dev/@octokit/core";
  import { createOAuthUserClientAuth } from "https://cdn.jsdelivr.net/gh/octokit/auth-oauth-user-client.js@v0.1.0/dist/index.min.js";

  const octokit = new Octokit({
    authStrategy: createOAuthUserClientAuth,
    auth: {
      clientId: "client_id", // get client id from https://github.com/settings/apps
      clientType: "github-app", // "github-app" | "oauth-app"
      expirationEnabled: true, // true | false
    },
  });

  const auth = await octokit.auth();
  if (!auth) await octokit.auth({ type: "signIn" });
  else console.log(await octokit.request("GET /user"));
</script>
```

## `createOAuthUserClientAuth(options)` or `new Octokit({auth})`

The `createOAuthUserClientAuth` method accepts a single `options` object as argument:

| name                    | type                | description                                                                                                                                                                                             |
| :---------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`clientId`**          | `string`            | **`Required`**. Find **Client ID** on the app’s about page in settings.                                                                                                                                 |
| **`clientType`**        | `string`            | **`Required`**. Either `"oauth-app"` or `"github-app"`.                                                                                                                                                 |
| **`expirationEnabled`** | `boolean`           | **`Required`**. `true` or `false` for GitHub App. `false` for OAuth App. Set according to app settings.                                                                                                 |
| **`auth`**              | `object`            | Initial authentication object, defaults to `null`. See [authentication object](#authentication-object).                                                                                                 |
| **`defaultScopes`**     | `string`            | Only relevant for OAuth App. See [available scopes](https://docs.github.com/en/developers/apps/scopes-for-oauth-apps#available-scopes).                                                                 |
| **`serviceOrigin`**     | `string`            | Defaults to `location.origin`. Required only when the `@octokit/oauth-app` Node.js/Express.js/Cloudflare middleware is deployed at a different origin.                                                  |
| **`servicePathPrefix`** | `string`            | Defaults to `"/api/github/oauth"`. Required only when the `@octokit/oauth-app` Node.js/Express.js/Cloudflare middleware is created with custom `pathPrefix`.                                            |
| **`authStore`**         | `object` or `false` | Custom store to get/set [authentication object](#authentication-object), `false` to disable persistence of authentication object. See [custom store](#custom-store).                                    |
| **`stateStore`**        | `object` or `false` | Custom store to get/set [state string](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#parameters), `false` to disable persistence of state string.               |
| **`request`**           | `function`          | You can pass in your own [`@octokit/request`](https://github.com/octokit/request.js) instance. For usage with enterprise, set `baseUrl` to the API root endpoint. See [custom request](#custom-request) |

### Custom Store

By default, `auth-oauth-user-client.js` uses [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) to store JSON
serialized authentication object and `state` string.

Pass `authStore` or `stateStore` in `createOAuthUserClientAuth(options)` (or
`new Octokit({auth})`) to use your custom code to persist authentication object
or `state` string.

For example:

```js
const authStore = {
  get: async() => {
  // return persisted authentication object when user is signed in;
  // returns `null` when user is signed out
  }
  set: async(auth) => {
    if (auth == null) { /* delete persisted authentication object */ }
    else { /* create or update persisted authentication object */ }
  }
}

const auth = createOAuthUserClientAuth({
  clientId: "client_id",
  authStore
});
```

## Authentication Object

The async `auth(options)` method returns to an authentication object. There are
three possible types of authentication object:

1. [OAuth APP authentication token](#oauth-app-authentication-token)
2. [GitHub APP user authentication token with expiring disabled](#github-app-user-authentication-token-with-expiring-disabled)
3. [GitHub APP user authentication token with expiring enabled](#github-app-user-authentication-token-with-expiring-enabled)

The differences are

1. `scopes` is only present for OAuth Apps
2. `refreshToken`, `expiresAt`, `refreshTokenExpiresAt` are only present for GitHub Apps, and only if token expiration is enabled

### OAuth APP Authentication Object

| name             | type               | description                                |
| :--------------- | :----------------- | :----------------------------------------- |
| **`type`**       | `string`           | `"token"`                                  |
| **`tokenType`**  | `string`           | `"oauth"`                                  |
| **`clientType`** | `string`           | `"oauth-app"`                              |
| **`clientId`**   | `string`           | Client id of the app                       |
| **`token`**      | `string`           | The user access token                      |
| **`scopes`**     | `array of strings` | Array of scope names enabled for the token |

### GitHub APP Authentication Object (Expiring Disabled)

| name             | type     | description           |
| :--------------- | :------- | :-------------------- |
| **`type`**       | `string` | `"token"`             |
| **`tokenType`**  | `string` | `"oauth"`             |
| **`clientType`** | `string` | `"github-app"`        |
| **`clientId`**   | `string` | Client id of the app  |
| **`token`**      | `string` | The user access token |

### GitHub APP Authentication Object (Expiring Enabled)

| name                        | type     | description                                                     |
| :-------------------------- | :------- | :-------------------------------------------------------------- |
| **`type`**                  | `string` | `"token"`                                                       |
| **`tokenType`**             | `string` | `"oauth"`                                                       |
| **`clientType`**            | `string` | `"github-app"`                                                  |
| **`clientId`**              | `string` | Client id of the app                                            |
| **`token`**                 | `string` | The user access token                                           |
| **`refreshToken`**          | `string` | The refresh token                                               |
| **`expiresAt`**             | `string` | Date in [ISO 8601][iso] format, e.g: `2011-10-05T14:48:00.000Z` |
| **`refreshTokenExpiresAt`** | `string` | Date in [ISO 8601][iso] format, e.g: `2011-10-05T14:48:00.000Z` |

[iso]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString

## Development

Although targeting browsers, this module is written, tested, and bundled using
[Deno](https://deno.land) for its simplicity.

- test: `deno test --location=https://acme.com/search?q=octokit --coverage=cov_profile`
- show coverage: `deno coverage cov_profile`
- bundle: `deno bundle src/index.ts dist/index.bundle.js`
- minify: `esbuild dist/index.bundle.js --minify --outfile=dist/index.min.js`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE)
