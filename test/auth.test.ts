import { createOAuthUserClientAuth } from "../src/index.ts";
import { NAME, VERSION } from "../src/metadata.ts";
import { Auth, GitHubApp } from "../src/types.ts";
import { createServerAuthenticationResponse } from "./utils.ts";
import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "std/testing/asserts.ts";
import {
  assertSpyCall,
  assertSpyCalls,
  returnsNext,
  spy,
  stub,
} from "std/testing/mock.ts";

const userAgent = `${NAME}/${VERSION} ${navigator.userAgent}`;

const oauthApp = "oauth-app";
const githubApp = "github-app";
const tokenType = "oauth";
const type = "token";
const clientId = "client_id";
const refreshToken1 = "refresh_token_1";
const refreshToken2 = "refresh_token_2";
const token1 = "token_123";
const token2 = "token_456";
const token3 = "token_789";
const past = "2000-01-01T00:00:00.000Z";
const future1 = "9999-01-01T00:00:00.000Z";
const future2 = "9999-01-02T00:00:00.000Z";
const stateKey = `${NAME}:STATE:${clientId}`;
const authKey = `${NAME}:AUTH:${clientId}`;

const gitHubAppExpiringValidAuth: Auth<GitHubApp, true> = {
  tokenType,
  type,
  clientId,
  clientType: githubApp,
  token: token1,
  expiresAt: future1,
  refreshToken: refreshToken1,
  refreshTokenExpiresAt: future1,
} as const;

const gitHubAppExpiredRenewableAuth: Auth<GitHubApp, true> = {
  tokenType,
  type,
  clientId,
  clientType: githubApp,
  token: token1,
  expiresAt: past,
  refreshToken: refreshToken1,
  refreshTokenExpiresAt: future1,
} as const;

const gitHubAppExpiredUnrenewableAuth: Auth<GitHubApp, true> = {
  tokenType,
  type,
  clientId,
  clientType: githubApp,
  token: token1,
  expiresAt: past,
  refreshToken: refreshToken1,
  refreshTokenExpiresAt: past,
} as const;

const checkedAuth = {
  tokenType,
  type,
  clientId,
  clientType: githubApp,
  token: token1,
} as const;

// authentication returned from reset token endpoint
const resettedAuth = {
  tokenType,
  type,
  clientId,
  clientType: githubApp,
  token: token2,
} as const;

// authentication returned from renew token endpoint
const renewedAuth = {
  tokenType,
  type,
  clientId,
  clientType: githubApp,
  token: token3,
  expiresAt: future2,
  refreshToken: refreshToken2,
  refreshTokenExpiresAt: future2,
} as const;

localStorage.clear();

// location needs be mocked for this test
Deno.test("sign in", async (t) => {
  await t.step("when signed out", async () => {
    const href = "https://acme.com/search?q=octokit";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      location,
    });

    assertEquals(localStorage.length, 0);
    assertEquals(await authenticator(), null);

    const auth = await authenticator({ type: "signIn" });
    assertEquals(auth, null);

    assertEquals(localStorage.length, 1);
    const state = JSON.parse(localStorage.getItem(stateKey)!);

    const url = new URL(location.href);
    assertEquals(url.origin, "https://github.com");
    assertEquals(url.pathname, "/login/oauth/authorize");
    assertEquals(url.searchParams.get("allow_signup"), "true");
    assertEquals(url.searchParams.get("client_id"), clientId);
    assertEquals(url.searchParams.get("redirect_uri"), href);
    assertEquals(url.searchParams.get("state"), state);

    localStorage.clear();
  });

  await t.step("when already signed in", async () => {
    const href = "https://acme.com/search?q=octokit";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
      location,
    });

    assertEquals(localStorage.length, 1);
    assertEquals(localStorage.key(0), authKey);
    assertEquals(await authenticator(), gitHubAppExpiringValidAuth);

    const auth = await authenticator({ type: "signIn" });
    assertEquals(auth, null);

    assertEquals(localStorage.length, 1);
    const state = JSON.parse(localStorage.getItem(stateKey)!);

    const url = new URL(location.href);
    assertEquals(url.origin, "https://github.com");
    assertEquals(url.pathname, "/login/oauth/authorize");
    assertEquals(url.searchParams.get("allow_signup"), "true");
    assertEquals(url.searchParams.get("client_id"), clientId);
    assertEquals(url.searchParams.get("redirect_uri"), href);
    assertEquals(url.searchParams.get("state"), state);

    localStorage.clear();
  });

  await t.step("accepts login, allowSignUp, and scopes", async () => {
    const href = "https://acme.com/search?q=octokit";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: oauthApp,
      expirationEnabled: false,
      location,
    });

    assertEquals(localStorage.length, 0);
    assertStrictEquals(await authenticator(), null);

    const login = "john";
    const allowSignup = false;
    const scopes = ["user", "repo"];
    const command = { type: "signIn", login, allowSignup, scopes } as const;
    const auth = await authenticator(command);
    assertStrictEquals(auth, null);

    assertEquals(localStorage.length, 1);
    const state = JSON.parse(localStorage.getItem(stateKey)!);

    const url = new URL(location.href);
    assertEquals(url.origin, "https://github.com");
    assertEquals(url.pathname, "/login/oauth/authorize");
    assertEquals(url.searchParams.get("allow_signup"), `${allowSignup}`);
    assertEquals(url.searchParams.get("client_id"), clientId);
    assertEquals(url.searchParams.get("login"), login);
    assertEquals(url.searchParams.get("redirect_uri"), href);
    assertEquals(url.searchParams.get("scope"), scopes.join(","));
    assertEquals(url.searchParams.get("state"), state);

    assertEquals(localStorage.length, 1);
    assertEquals(localStorage.key(0), stateKey);

    localStorage.clear();
  });
});

Deno.test("get token", async (t) => {
  await t.step("when signed out", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
    });

    assertEquals(await authenticator(), null);
    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });

  await t.step("when signed out, no auth store", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      authStore: false,
    });

    assertEquals(await authenticator(), null);
    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });

  await t.step("initial authentication from code", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    assertEquals(await authenticator(), gitHubAppExpiringValidAuth);
    assertEquals(localStorage.length, 1);
    assertEquals(localStorage.key(0), authKey);
    localStorage.clear();
  });

  await t.step("initial authentication from store", async () => {
    localStorage.setItem(authKey, JSON.stringify(gitHubAppExpiringValidAuth));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
    });

    assertEquals(await authenticator(), gitHubAppExpiringValidAuth);
    assertEquals(localStorage.length, 1);
    assertEquals(localStorage.key(0), authKey);
    localStorage.clear();
  });

  await t.step("expiring but still valid", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    assertStrictEquals(await authenticator(), gitHubAppExpiringValidAuth);
    localStorage.clear();
  });

  await t.step("expired but renewable", async () => {
    const response = createServerAuthenticationResponse(renewedAuth);
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredRenewableAuth,
    });

    assertEquals(await authenticator(), renewedAuth);

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: ["https://acme.com/api/github/oauth/refresh-token", {
        method: "PATCH",
        headers: {
          "user-agent": userAgent,
          authorization: `token ${gitHubAppExpiredRenewableAuth.token}`,
          "content-type": "application/json; charset=utf-8",
          accept: "application/json",
        },
        body: JSON.stringify({
          refreshToken: gitHubAppExpiredRenewableAuth.refreshToken,
        }),
      }],
    });

    assertEquals(localStorage.length, 1);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired and unrenewable", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredUnrenewableAuth,
    });

    assertStrictEquals(await authenticator(), null);
    assertStrictEquals(localStorage.length, 0);

    localStorage.clear();
  });
});

Deno.test("create token", async (t) => {
  await t.step("using get token", async () => {
    const response = createServerAuthenticationResponse(
      gitHubAppExpiringValidAuth,
    );
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const replaceState = () => {};
    const replaceStateSpy = spy(replaceState);
    Object.assign(window, { history: { replaceState: replaceStateSpy } });
    localStorage.setItem(stateKey, JSON.stringify("state"));
    const href = "https://acme.com/search?q=octokit&code=code&state=state";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      location,
    });

    assertEquals(
      await authenticator({ type: "getToken" }),
      gitHubAppExpiringValidAuth,
    );

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "POST",
          headers: {
            "user-agent": userAgent,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            "state": "state",
            "code": "code",
            "redirectUrl": "https://acme.com/search?q=octokit",
          }),
        },
      ],
    });

    assertSpyCalls(replaceStateSpy, 1);
    assertSpyCall(replaceStateSpy, 0, {
      args: [{}, "", "https://acme.com/search?q=octokit"],
    });

    assertEquals(localStorage.length, 1);
    assertEquals(
      JSON.parse(localStorage.getItem(authKey) as string),
      gitHubAppExpiringValidAuth,
    );

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("when signed out", async () => {
    const response = createServerAuthenticationResponse(
      gitHubAppExpiringValidAuth,
    );
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const replaceState = () => {};
    const replaceStateSpy = spy(replaceState);
    Object.assign(window, { history: { replaceState: replaceStateSpy } });
    localStorage.setItem(stateKey, JSON.stringify("state"));
    const href = "https://acme.com/search?q=octokit&code=code&state=state";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      location,
    });

    assertEquals(
      await authenticator({ type: "createToken" }),
      gitHubAppExpiringValidAuth,
    );

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "POST",
          headers: {
            "user-agent": userAgent,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            "state": "state",
            "code": "code",
            "redirectUrl": "https://acme.com/search?q=octokit",
          }),
        },
      ],
    });

    assertSpyCalls(replaceStateSpy, 1);
    assertSpyCall(replaceStateSpy, 0, {
      args: [{}, "", "https://acme.com/search?q=octokit"],
    });

    assertEquals(localStorage.length, 1);
    assertEquals(
      JSON.parse(localStorage.getItem(authKey) as string),
      gitHubAppExpiringValidAuth,
    );

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("state mismatch", async () => {
    localStorage.setItem(stateKey, JSON.stringify("foo"));
    const href = "https://acme.com/search?q=octokit&code=code&state=bar";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      location,
    });

    await assertRejects(
      () => authenticator({ type: "createToken" }),
      Error,
      "State mismatch.",
    );

    localStorage.clear();
  });

  await t.step("when already signed in", async () => {
    const response = createServerAuthenticationResponse(
      gitHubAppExpiringValidAuth,
    );
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const replaceState = () => {};
    const replaceStateSpy = spy(replaceState);
    Object.assign(window, { history: { replaceState: replaceStateSpy } });
    localStorage.setItem(stateKey, JSON.stringify("state"));
    const href = "https://acme.com/search?q=octokit&code=code&state=state";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      location,
      auth: {} as unknown as Auth<GitHubApp, true>,
    });

    assertEquals(
      await authenticator({ type: "createToken" }),
      gitHubAppExpiringValidAuth,
    );

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "POST",
          headers: {
            "user-agent": userAgent,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            "state": "state",
            "code": "code",
            "redirectUrl": "https://acme.com/search?q=octokit",
          }),
        },
      ],
    });

    assertSpyCalls(replaceStateSpy, 1);
    assertSpyCall(replaceStateSpy, 0, {
      args: [{}, "", "https://acme.com/search?q=octokit"],
    });

    assertEquals(localStorage.length, 1);
    assertEquals(
      JSON.parse(localStorage.getItem(authKey) as string),
      gitHubAppExpiringValidAuth,
    );

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("no state store", async () => {
    const response = createServerAuthenticationResponse(
      gitHubAppExpiringValidAuth,
    );
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const replaceState = () => {};
    const replaceStateSpy = spy(replaceState);
    Object.assign(window, { history: { replaceState: replaceStateSpy } });
    const href = "https://acme.com/search?q=octokit&code=code&state=state";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      stateStore: false,
      location,
    });

    assertEquals(
      await authenticator({ type: "createToken" }),
      gitHubAppExpiringValidAuth,
    );

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "POST",
          headers: {
            "user-agent": userAgent,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            "state": "state",
            "code": "code",
            "redirectUrl": "https://acme.com/search?q=octokit",
          }),
        },
      ],
    });

    assertEquals(localStorage.length, 1);
    assertEquals(
      JSON.parse(localStorage.getItem(authKey) as string),
      gitHubAppExpiringValidAuth,
    );

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("missing code", async () => {
    const href = "https://acme.com/search?q=octokit&state=state";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      location,
    });

    await assertRejects(
      () => authenticator({ type: "createToken" }),
      Error,
      'Both "code" & "state" parameters are required.',
    );

    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });

  await t.step("missing state", async () => {
    const href = "https://acme.com/search?q=octokit&code=code";
    const location = { href } as Location;
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      location,
    });

    await assertRejects(
      () => authenticator({ type: "createToken" }),
      Error,
      'Both "code" & "state" parameters are required.',
    );

    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });
});

Deno.test("check token", async (t) => {
  await t.step("when signed out", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
    });

    await assertRejects(
      () => authenticator({ type: "checkToken" }),
      Error,
      "Unauthorized.",
    );

    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });

  await t.step("expiring but still valid", async () => {
    const response = createServerAuthenticationResponse(checkedAuth);
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    assertEquals(await authenticator({ type: "checkToken" })!, {
      ...gitHubAppExpiringValidAuth,
      ...checkedAuth,
    });

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "GET",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiringValidAuth.token}`,
            accept: "application/json",
          },
        },
      ],
    });

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired but renewable", async () => {
    const response1 = createServerAuthenticationResponse(renewedAuth);
    const response2 = createServerAuthenticationResponse(checkedAuth);
    const fetchStub = stub(
      window,
      "fetch",
      returnsNext([response1, response2]),
    );
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredRenewableAuth,
    });

    assertEquals(await authenticator({ type: "checkToken" }), {
      ...renewedAuth,
      ...checkedAuth,
    });

    assertSpyCalls(fetchStub, 2);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/refresh-token",
        {
          method: "PATCH",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiredRenewableAuth.token}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            refreshToken: gitHubAppExpiredRenewableAuth.refreshToken,
          }),
        },
      ],
    });
    assertSpyCall(fetchStub, 1, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "GET",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${renewedAuth.token}`,
            accept: "application/json",
          },
        },
      ],
    });

    assertEquals(localStorage.length, 1);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired and unrenewable", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredUnrenewableAuth,
    });

    await assertRejects(
      () => authenticator({ type: "checkToken" }),
      Error,
      "Unauthorized.",
    );

    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });
});

Deno.test("reset token", async (t) => {
  await t.step("when signed out", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
    });

    await assertRejects(
      () => authenticator({ type: "resetToken" }),
      Error,
      "Unauthorized.",
    );

    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });

  await t.step("expiring but still valid", async () => {
    const response = createServerAuthenticationResponse(resettedAuth);
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    assertEquals(await authenticator({ type: "resetToken" }), {
      ...gitHubAppExpiringValidAuth,
      ...resettedAuth,
    });

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "PATCH",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiringValidAuth.token}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: "{}",
        },
      ],
    });
    assertEquals(localStorage.length, 1);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired but renewable", async () => {
    const response1 = createServerAuthenticationResponse(renewedAuth);
    const response2 = createServerAuthenticationResponse(resettedAuth);
    const fetchStub = stub(
      window,
      "fetch",
      returnsNext([response1, response2]),
    );
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredRenewableAuth,
    });

    assertEquals(await authenticator({ type: "resetToken" }), {
      ...renewedAuth,
      ...resettedAuth,
    });

    assertSpyCalls(fetchStub, 2);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/refresh-token",
        {
          method: "PATCH",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiredRenewableAuth.token}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            refreshToken: gitHubAppExpiredRenewableAuth.refreshToken,
          }),
        },
      ],
    });
    assertSpyCall(fetchStub, 1, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "PATCH",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${renewedAuth.token}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: "{}",
        },
      ],
    });

    assertEquals(localStorage.length, 1);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired and unrenewable", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredUnrenewableAuth,
    });

    await assertRejects(
      () => authenticator({ type: "resetToken" }),
      Error,
      "Unauthorized.",
    );

    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });
});

Deno.test("renew token", async (t) => {
  await t.step("when signed out", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
    });

    await assertRejects(
      () => authenticator({ type: "renewToken" }),
      Error,
      "Unauthorized.",
    );

    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });

  await t.step("expiring but still valid", async () => {
    const response = createServerAuthenticationResponse(renewedAuth);
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    assertEquals(await authenticator({ type: "renewToken" }), renewedAuth);

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/refresh-token",
        {
          method: "PATCH",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiredRenewableAuth.token}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            refreshToken: gitHubAppExpiringValidAuth.refreshToken,
          }),
        },
      ],
    });

    assertEquals(localStorage.length, 1);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired but renewable", async () => {
    const response = createServerAuthenticationResponse(renewedAuth);
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredRenewableAuth,
    });

    assertEquals(await authenticator({ type: "renewToken" }), renewedAuth);

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/refresh-token",
        {
          method: "PATCH",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiredRenewableAuth.token}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            refreshToken: gitHubAppExpiredRenewableAuth.refreshToken,
          }),
        },
      ],
    });

    assertEquals(localStorage.length, 1);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired and unrenewable", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredUnrenewableAuth,
    });

    assertStrictEquals(await authenticator({ type: "renewToken" }), null);
    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });
});

Deno.test("delete token", async (t) => {
  await t.step("when signed out", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
    });
    await assertRejects(
      () => authenticator({ type: "deleteToken" }),
      Error,
      "Unauthorized.",
    );
  });

  await t.step("expiring but still valid", async () => {
    const response = createServerAuthenticationResponse(null);
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    assertEquals(await authenticator({ type: "deleteToken" }), null);

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "DELETE",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiringValidAuth.token}`,
            accept: "application/json",
          },
        },
      ],
    });

    assertEquals(localStorage.length, 0);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired but renewable", async () => {
    const response1 = createServerAuthenticationResponse(renewedAuth);
    const response2 = createServerAuthenticationResponse(null);
    const fetchStub = stub(
      window,
      "fetch",
      returnsNext([response1, response2]),
    );
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredRenewableAuth,
    });

    assertEquals(await authenticator({ type: "deleteToken" }), null);

    assertSpyCalls(fetchStub, 2);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/refresh-token",
        {
          method: "PATCH",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiredRenewableAuth.token}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({ refreshToken: "refresh_token_1" }),
        },
      ],
    });
    assertSpyCall(fetchStub, 1, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "DELETE",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${renewedAuth.token}`,
            accept: "application/json",
          },
        },
      ],
    });

    assertEquals(localStorage.length, 0);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired and unrenewable", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredUnrenewableAuth,
    });

    await assertRejects(
      () => authenticator({ type: "deleteToken" }),
      Error,
      "Unauthorized.",
    );
  });

  await t.step("offline", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    assertEquals(
      await authenticator({ type: "deleteToken", offline: true }),
      null,
    );

    assertEquals(localStorage.length, 0);
    localStorage.clear();
  });

  await t.step("on service error", async () => {
    const error = "service error";
    const response = Promise.resolve(new Response(error, { status: 500 }));
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    await assertRejects(
      () => authenticator({ type: "deleteToken" }),
      Error,
      "service error",
    );

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/token",
        {
          method: "DELETE",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiringValidAuth.token}`,
            accept: "application/json",
          },
        },
      ],
    });

    assertEquals(localStorage.length, 0);

    fetchStub.restore();
    localStorage.clear();
  });
});

Deno.test("delete authorization", async (t) => {
  await t.step("when signed out", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
    });
    await assertRejects(
      () => authenticator({ type: "deleteAuthorization" }),
      Error,
      "Unauthorized.",
    );
  });

  await t.step("expiring but still valid", async () => {
    const response = createServerAuthenticationResponse(null);
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    assertEquals(await authenticator({ type: "deleteAuthorization" }), null);

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/grant",
        {
          method: "DELETE",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiringValidAuth.token}`,
            accept: "application/json",
          },
        },
      ],
    });

    assertEquals(localStorage.length, 0);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired but renewable", async () => {
    const response1 = createServerAuthenticationResponse(renewedAuth);
    const response2 = createServerAuthenticationResponse(null);
    const fetchStub = stub(
      window,
      "fetch",
      returnsNext([response1, response2]),
    );
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredRenewableAuth,
    });

    assertEquals(await authenticator({ type: "deleteAuthorization" }), null);

    assertSpyCalls(fetchStub, 2);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/refresh-token",
        {
          method: "PATCH",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiredRenewableAuth.token}`,
            "content-type": "application/json; charset=utf-8",
            accept: "application/json",
          },
          body: JSON.stringify({
            refreshToken: gitHubAppExpiredRenewableAuth.refreshToken,
          }),
        },
      ],
    });
    assertSpyCall(fetchStub, 1, {
      args: [
        "https://acme.com/api/github/oauth/grant",
        {
          method: "DELETE",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${renewedAuth.token}`,
            accept: "application/json",
          },
        },
      ],
    });

    assertEquals(localStorage.length, 0);

    fetchStub.restore();
    localStorage.clear();
  });

  await t.step("expired and unrenewable", async () => {
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiredUnrenewableAuth,
    });

    await assertRejects(
      () => authenticator({ type: "deleteAuthorization" }),
      Error,
      "Unauthorized.",
    );
  });

  await t.step("on service error", async () => {
    const error = "service error";
    const response = Promise.resolve(new Response(error, { status: 500 }));
    const fetchStub = stub(window, "fetch", returnsNext([response]));
    const authenticator = createOAuthUserClientAuth({
      clientId,
      clientType: githubApp,
      expirationEnabled: true,
      auth: gitHubAppExpiringValidAuth,
    });

    await assertRejects(
      () => authenticator({ type: "deleteAuthorization" }),
      Error,
      error,
    );

    assertSpyCalls(fetchStub, 1);
    assertSpyCall(fetchStub, 0, {
      args: [
        "https://acme.com/api/github/oauth/grant",
        {
          method: "DELETE",
          headers: {
            "user-agent": userAgent,
            authorization: `token ${gitHubAppExpiringValidAuth.token}`,
            accept: "application/json",
          },
        },
      ],
    });

    assertEquals(localStorage.length, 0);

    fetchStub.restore();
    localStorage.clear();
  });
});
