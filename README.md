# auth-oauth-user-client.js

> OAuth user authentication without exposing client secret

[![@latest](https://img.shields.io/npm/v/@octokit/auth-oauth-user-client.svg)](https://www.npmjs.com/package/@octokit/auth-oauth-user-client)
[![Build Status](https://github.com/octokit/auth-oauth-user-client.js/workflows/Test/badge.svg)](https://github.com/octokit/auth-oauth-user-client.js/actions?query=workflow%3ATest+branch%3Amain)

<details>
<summary>Table of contents</summary>

<!-- toc -->

- [Standalone usage](#standalone-usage)
- [Usage with Octokit](#usage-with-octokit)
- [`createOAuthUserClientAuth(options)`](#createoauthuserclientauthoptions)
- [`auth(options)`](#authoptions)
- [Authentication object](#authentication-object)
- [`auth.hook(request, route, parameters)` or `auth.hook(request, options)`](#authhookrequest-route-parameters-or-authhookrequest-options)
- [Contributing](#contributing)
- [License](#license)

<!-- tocstop -->

</details>

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

Install with `npm install @octokit/core @octokit/auth-oauth-user-client`

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
  // default functions to to create/check/reset/refresh/delete token and to delete authorization for the app
  async getSession(authentication) {
    if (authentication.token) {
      return {
        ...authentication,
        isSignedIn: true,
      };
    }
    return { isSigned: false };
  },
  signIn() {
    location.href = "/api/github/oauth/login";
  },
  async createToken() {
    const code = new URL(location.href).searchParams.get("code");
    if (!code) throw new Error("?code query parameter is not set");

    // remove ?code=... from URL
    const path =
      location.pathname +
      location.search.replace(/\b(code|state)=\w+/g, "").replace(/[?&]+$/, "");
    history.pushState({}, "", path);

    const response = await fetch("/api/github/oauth/token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    return response.json();
  },
  async checkToken({ token }) {
    return fetch("/api/github/oauth/token", {
      headers: {
        authorization: "token " + token,
      },
    }).then(
      () => true,
      (error) => {
        if (error.status === 404) return false;
        throw error;
      }
    );
  },
  async resetToken({ token }) {
    const response = await fetch("/api/github/oauth/token", {
      method: "patch",
      headers: {
        authorization: "token " + token,
      },
    });
    return response.json();
  },
  async refreshToken({ token, refreshToken }) {
    const response = await fetch("/api/github/oauth/refresh-token", {
      method: "patch",
      headers: {
        authorization: "token " + token,
      },
      body: JSON.stringify({ refreshToken }),
    });
    return response.json();
  },
  async deleteToken({ token }, { offline }) {
    if (offline) return;
    await fetch("/api/github/oauth/token", {
      method: "delete",
      headers: {
        authorization: "token " + token,
      },
    });
  },
  async deleteAuthorization({ token }) {
    await fetch("/api/github/oauth/grant", {
      method: "delete",
      headers: {
        authorization: "token " + token,
      },
    });
  },
  // persist authentication in local store
  // set to false to disable persistance
  authStore: {
    async get(key) {
      return JSON.parse(localStorage.getItem(key));
    },
    async set(key, authentication) {
      localStorage.setItem(key, JSON.stringify(authentication));
    },
    async del(key) {
      localStorage.removeItem(key);
    },
  },
  // persist code verification state in local store
  // set to false to disable persistance
  stateStore: {
    async get(key) {
      return localStorage.getItem(key);
    },
    async set(key, state) {
      localStorage.setItem(key, state);
    },
    async del(key) {
      localStorage.removeItem(key);
    },
  },
});

// retrieve token using `createToken({ type: "getSession" })`
// if ?code=... parameter is not set and authentication cannot be retrievd from the local store,
// then `token` is undefined and `isSignedIn` is set to false`
// `type` is either `app` or `oauth-app`.
// `scopes` is only set for OAuth apps.
// `refreshToken` and `exprisesAt` is only set for GitHub apps, only only when enabled.
const {
  token,
  type,
  isSignedIn,
  createdAt,
  scopes,
  refreshToken,
  expiresAt,
} = await auth({
  type: "getSession",
});

// - Sign in (redirects to OAuth authorization page): {type: "signIn"}
// - Exchange the OAuth code for token: {type: "createToken"}
// - Verify current token: {type: "checkToken"}
// - Delete and invalidate token: {type: "deleteToken"}
// - Delete without invalidation: {type: "deleteToken", offline: true}
// - Reset a token, pass {type: "resetToken"}
// - Revoke access for the OAuth App, pass {type: "deleteAuthorization"}
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
    // default functions to to create/check/reset/refresh/delete token and to delete authorization for the app
    async getSession(authentication) {
      if (authentication.token) {
        return {
          ...authentication,
          isSignedIn: true,
        };
      }
      return { isSigned: false };
    },
    signIn() {
      location.href = "/api/github/oauth/login";
    },
    async createToken() {
      const code = new URL(location.href).searchParams.get("code");
      if (!code) throw new Error("?code query parameter is not set");

      // remove ?code=... from URL
      const path =
        location.pathname +
        location.search
          .replace(/\b(code|state)=\w+/g, "")
          .replace(/[?&]+$/, "");
      history.pushState({}, "", path);

      const response = await octokit.request(
        location.origin + "/api/github/oauth/token",
        {
          method: "POST",
          body: JSON.stringify({ code }),
        }
      );
      return response.json();
    },
    async checkToken() {
      return fetch(location.origin + "/api/github/oauth/token", {}).then(
        () => true,
        (error) => {
          if (error.status === 404) return false;
          throw error;
        }
      );
    },
    async resetToken() {
      const response = await octokit.request(
        location.origin + "/api/github/oauth/token",
        {
          method: "patch",
        }
      );
      return response.json();
    },
    async refreshToken({ refreshToken }) {
      const response = await octokit.request(
        location.origin + "/api/github/oauth/refresh-token",
        {
          method: "patch",
          refreshToken,
        }
      );
      return response.json();
    },
    async deleteToken(authorization, { offline }) {
      if (offline) return;
      await octokit.request(location.origin + "/api/github/oauth/token", {
        method: "delete",
      });
    },
    async deleteAuthorization() {
      await octokit.request(location.origin + "/api/github/oauth/grant", {
        method: "delete",
      });
    },
    // persist authentication in local store
    // set to false to disable persistance
    authStore: {
      async get(key) {
        return JSON.parse(localStorage.getItem(key));
      },
      async set(key, authentication) {
        localStorage.setItem(key, JSON.stringify(authentication));
      },
      async del(key) {
        localStorage.removeItem(key);
      },
    },
    // persist code verification state in local store
    // set to false to disable persistance
    stateStore: {
      async get(key) {
        return localStorage.getItem(key);
      },
      async set(key, state) {
        localStorage.setItem(key, state);
      },
      async del(key) {
        localStorage.removeItem(key);
      },
    },
  },
});

// retrieve token using `createToken({ type: "getSession" })`
// if ?code=... parameter is not set and authentication cannot be retrievd from the local store,
// then `token` is undefined and `isSignedIn` is set to false`
// `type` is either `app` or `oauth-app`.
// `scopes` is only set for OAuth apps.
// `refreshToken` and `exprisesAt` is only set for GitHub apps, only only when enabled.
const {
  token,
  type,
  isSignedIn,
  createdAt,
  scopes,
  refreshToken,
  expiresAt,
} = await octokit.auth({
  type: "getSession",
});

// - Sign in (redirects to OAuth authorization page): {type: "signIn"}
// - Exchange the OAuth code for token: {type: "createToken"}
// - Verify current token: {type: "checkToken"}
// - Delete and invalidate token: {type: "deleteToken"}
// - Delete without invalidation: {type: "deleteToken", offline: true}
// - Reset a token, pass {type: "resetToken"}
// - Revoke access for the OAuth App, pass {type: "deleteAuthorization"}
```

## `createOAuthUserClientAuth(options)`

The `createOAuthUserClientAuth` method accepts a single `options` object as argument

<table width="100%">
  <thead align=left>
    <tr>
      <th width=150>
        name
      </th>
      <th width=70>
        type
      </th>
      <th>
        description
      </th>
    </tr>
  </thead>
  <tbody align=left valign=top>
    <tr>
      <th>
        <code>options.myOption</code>
      </th>
      <th>
        <code>string</code>
      </th>
      <td>
        <strong>Required</strong>. Description here
      </td>
    </tr>
  </tbody>
</table>

## `auth(options)`

The async `auth()` method returned by `createOAuthUserClientAuth(options)` accepts the following options

<table width="100%">
  <thead align=left>
    <tr>
      <th width=150>
        name
      </th>
      <th width=70>
        type
      </th>
      <th>
        description
      </th>
    </tr>
  </thead>
  <tbody align=left valign=top>
    <tr>
      <th>
        <code>options.myOption</code>
      </th>
      <th>
        <code>string</code>
      </th>
      <td>
        <strong>Required.</strong> Description here
      </td>
    </tr>
  </tbody>
</table>

## Authentication object

The async `auth(options)` method resolves to an object with the following properties

<table width="100%">
  <thead align=left>
    <tr>
      <th width=150>
        name
      </th>
      <th width=70>
        type
      </th>
      <th>
        description
      </th>
    </tr>
  </thead>
  <tbody align=left valign=top>
    <tr>
      <th>
        <code>type</code>
      </th>
      <th>
        <code>string</code>
      </th>
      <td>
        <code>"myType"</code>
      </td>
    </tr>
  </tbody>
</table>

## `auth.hook(request, route, parameters)` or `auth.hook(request, options)`

`auth.hook()` hooks directly into the request life cycle. It amends the request to authenticate correctly based on the request URL.

The `request` option is an instance of [`@octokit/request`](https://github.com/octokit/request.js#readme). The `route`/`options` parameters are the same as for the [`request()` method](https://github.com/octokit/request.js#request).

`auth.hook()` can be called directly to send an authenticated request

```js
const { data: user } = await auth.hook(request, "GET /user");
```

Or it can be passed as option to [`request()`](https://github.com/octokit/request.js#request).

```js
const requestWithAuth = request.defaults({
  request: {
    hook: auth.hook,
  },
});

const { data: user } = await requestWithAuth("GET /user");
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

[MIT](LICENSE)
