import { request } from "@octokit/request";
import fetchMock from "fetch-mock";
import MockDate from "mockdate";
import { createOAuthUserClientAuth } from "../src/index";

const replaceState = jest
  .fn()
  .mockImplementation((_stateObject: any, _title: any, url: string) => {
    Object.assign(global, { location: new URL(url) });
  });

describe("standalone tests under node environment", () => {
  // jsdom does not support redirect.
  beforeEach(() => {
    Object.assign(global, {
      history: { replaceState },
      location: new URL("http://acme.com/search?q=octocat&sort=date"),
    });
  });

  afterEach(() => {
    // @ts-ignore
    delete global.location;
    jest.clearAllMocks();
  });

  it("oauth app does not support token expiration", async () => {
    expect(() =>
      createOAuthUserClientAuth({
        clientId: "clientId123",
        clientType: "oauth-app",
        expirationEnabled: true,
      })
    ).toThrow(
      "[@octokit/auth-oauth-user-client.js] OAuth App does not support token expiration."
    );
  });

  //#region Get Token

  it("get token (without session/state stores)", async () => {
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore: false,
      stateStore: false,
    });
    expect(await auth({ type: "getToken" })).toBeNull();
  });

  it("get token (without cached session)", async () => {
    const sessionStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
    });

    expect(await auth({ type: "getToken" })).toBeNull();
    expect(await auth({ type: "getToken" })).toBeNull();
    expect(sessionStore.get.mock.calls.length).toBe(2);
  });

  it("get token (with cached session)", async () => {
    const session = { authentication: { token: "token123" } };
    const sessionStore = {
      get: jest.fn().mockResolvedValue(session),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
    });
    expect(await auth({ type: "getToken" })).toBe(session);
    expect(await auth({ type: "getToken" })).toBe(session);
    expect(sessionStore.get.mock.calls.length).toBe(1);
  });

  it("get token (not expired)", async () => {
    const session = {
      authentication: {
        token: "token123",
        expiresAt: "2000-01-03T00:00:00.000Z",
        refreshToken: "refreshToken123",
      },
    };

    const sessionStore = {
      get: jest.fn().mockResolvedValueOnce(session),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      expirationEnabled: true,
      sessionStore,
    });

    MockDate.set("2000-01-02T00:00:00.000Z");
    expect(await auth({ type: "getToken" })).toEqual(session);
    expect(sessionStore.get.mock.calls.length).toBe(1);
    MockDate.reset();
  });

  it("get token (expired)", async () => {
    const oldSession = {
      authentication: {
        token: "token123",
        expiresAt: "2000-01-01T00:00:00.000Z",
        refreshToken: "refreshToken123",
      },
    };

    const newSession = {
      authentication: {
        token: "token456",
        expiresAt: "2000-02-01T00:00:00.000Z",
        refreshToken: "refreshToken456",
      },
    };

    const sessionStore = {
      get: jest.fn().mockResolvedValueOnce(oldSession),
      set: jest.fn(async (session) => {
        expect(session).toEqual(newSession);
      }),
    };

    const fetch = fetchMock
      .sandbox()
      .patchOnce("http://acme.com/api/github/oauth/refresh-token", newSession, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          "content-type": "application/json; charset=utf-8",
        },
        body: { refreshToken: "refreshToken123" },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      sessionStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    MockDate.set("2000-01-02T00:00:00.000Z");
    expect(await auth({ type: "getToken" })).toEqual(newSession);
    expect(sessionStore.get.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls.length).toBe(1);
    MockDate.reset();
  });

  it("get token (with code & state)", async () => {
    const href =
      "http://acme.com/search?q=octocat&sort=date&code=code&state=state";
    Object.assign(global, { location: new URL(href) });

    const validSession = {
      authentication: {
        token: "token456",
        expiresAt: "2000-02-01T00:00:00.000Z",
        refreshToken: "refreshToken123",
      },
    };

    const fetch = fetchMock
      .sandbox()
      .postOnce("http://acme.com/api/github/oauth/token", validSession, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          "content-type": "application/json; charset=utf-8",
        },
        body: {
          code: "code",
          redirectUrl: "http://acme.com/search?q=octocat&sort=date",
          state: "state",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "oauth-app",
      sessionStore: { get: async () => null, set: async () => {} },
      stateStore: { get: async () => "state", set: async () => {} },
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "getToken" })).toEqual(validSession);
    // expect(replaceState.mock.calls.length).toBe(1);
    expect(location.href).toBe("http://acme.com/search?q=octocat&sort=date");
  });

  //#endregion

  //#region Sign In

  it("sign in", async () => {
    const sessionStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockImplementation(() => {}),
    };
    const stateStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockImplementation(() => {}),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
      stateStore,
    });
    await auth({ type: "signIn" });
    expect(
      location.href.startsWith("https://github.com/login/oauth/authorize")
    ).toBe(true);
    expect(sessionStore.get.mock.calls.length).toBe(0);
    expect(sessionStore.set.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls[0][0]).toBe(null);
    expect(stateStore.get.mock.calls.length).toBe(0);
    expect(stateStore.set.mock.calls.length).toBe(1);
    expect(stateStore.set.mock.calls[0][0]).toBe(
      new URL(location.href).searchParams.get("state")
    );
  });

  it("sign in (without session/state stores)", async () => {
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      expirationEnabled: true,
      sessionStore: false,
      stateStore: false,
    });
    await auth({ type: "signIn" });
    expect(
      location.href.startsWith("https://github.com/login/oauth/authorize")
    ).toBe(true);
  });

  it("sign in (specified scopes)", async () => {
    const sessionStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(async () => {}),
    };
    const stateStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(async () => {}),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "oauth-app",
      sessionStore,
      stateStore,
    });
    await auth({ type: "signIn", scopes: ["abc", "def"] });
    expect(
      location.href.startsWith("https://github.com/login/oauth/authorize")
    ).toBe(true);
    expect(new URL(location.href).searchParams.get("scope")).toBe("abc,def");
  });

  it("sign in (default scopes)", async () => {
    const sessionStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(async () => {}),
    };
    const stateStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(async () => {}),
    };
    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "oauth-app",
      sessionStore,
      stateStore,
      defaultScopes: ["abc", "def"],
    });
    await auth({ type: "signIn" });
    expect(
      location.href.startsWith("https://github.com/login/oauth/authorize")
    ).toBe(true);
    expect(new URL(location.href).searchParams.get("scope")).toBe("abc,def");
  });

  //#endregion

  //#region Create Token

  it("create token", async () => {
    const href =
      "http://acme.com/search?q=octocat&sort=date&code=code&state=state";
    Object.assign(global, { location: new URL(href) });

    const stateStore = {
      get: jest.fn().mockResolvedValue("state"),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const validSession = { authentication: { token: "token456" } };

    const fetch = fetchMock
      .sandbox()
      .postOnce("http://acme.com/api/github/oauth/token", validSession, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          "content-type": "application/json; charset=utf-8",
        },
        body: {
          code: "code",
          redirectUrl: "http://acme.com/search?q=octocat&sort=date",
          state: "state",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore: false,
      stateStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "createToken" })).toEqual(validSession);
    expect(stateStore.get.mock.calls.length).toBe(1);
    expect(stateStore.set.mock.calls.length).toBe(1);
    expect(stateStore.set.mock.calls[0][0]).toBeNull();
    expect(replaceState.mock.calls.length).toBe(1);
    expect(location.href).toBe("http://acme.com/search?q=octocat&sort=date");
  });

  it("create token (missing code)", async () => {
    const href = "http://acme.com/search?q=octocat&sort=date&state=state";
    Object.assign(global, { location: new URL(href) });
    const auth = createOAuthUserClientAuth({ clientId: "clientId123" });

    await expect(
      async () => await auth({ type: "createToken" })
    ).rejects.toThrow(
      '[@octokit/auth-oauth-user-client.js] Both "code" & "state" parameters are required.'
    );
  });

  it("create token (missing state)", async () => {
    const href = "http://acme.com/search?q=octocat&sort=date&code=code";
    Object.assign(global, { location: new URL(href) });
    const auth = createOAuthUserClientAuth({ clientId: "clientId123" });

    await expect(
      async () => await auth({ type: "createToken" })
    ).rejects.toThrow(
      '[@octokit/auth-oauth-user-client.js] Both "code" & "state" parameters are required.'
    );
  });

  it("create token (state mismatch)", async () => {
    const href =
      "http://acme.com/search?q=octocat&sort=date&code=code&state=state";
    Object.assign(global, { location: new URL(href) });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      stateStore: { get: async () => "mismatch", set: async () => {} },
    });

    await expect(
      async () => await auth({ type: "createToken" })
    ).rejects.toThrow("[@octokit/auth-oauth-user-client.js] State mismatch");
  });

  it("create token (without session/state store)", async () => {
    const href =
      "http://acme.com/search?q=octocat&sort=date&code=code&state=state";
    Object.assign(global, { location: new URL(href) });
    const session = { authentication: { token: "token123" } };

    const fetch = fetchMock
      .sandbox()
      .postOnce("http://acme.com/api/github/oauth/token", session, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          "content-type": "application/json; charset=utf-8",
        },
        body: {
          code: "code",
          redirectUrl: "http://acme.com/search?q=octocat&sort=date",
          state: "state",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore: false,
      stateStore: false,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "createToken" })).toEqual(session);
    expect(await auth()).toEqual(session);
    expect(replaceState.mock.calls.length).toBe(1);
    expect(location.href).toBe("http://acme.com/search?q=octocat&sort=date");
  });

  //#endregion

  //#region Check Token

  it("check token (unauthorized)", async () => {
    const sessionStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
    });

    await expect(
      async () => await auth({ type: "checkToken" })
    ).rejects.toThrow("[@octokit/auth-oauth-user-client.js] Unauthorized");
    expect(sessionStore.get.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls.length).toBe(0);
  });

  it("check token", async () => {
    const newSession = { authentication: { token: "token123" } };
    const oldSession = { authentication: { token: "token123" } };

    const sessionStore = {
      get: jest.fn().mockResolvedValue(oldSession),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .getOnce("http://acme.com/api/github/oauth/token", newSession, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "checkToken" })).toEqual(newSession);
    expect(sessionStore.get.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls[0][0]).toEqual(newSession);
  });

  //#endregion

  it("create scoped token", async () => {
    const oldSession = { authentication: { token: "token123" } };
    const newSession = { authentication: { token: "token456" } };

    const sessionStore = {
      get: jest.fn().mockResolvedValue(oldSession),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .postOnce("http://acme.com/api/github/oauth/token/scoped", newSession, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      sessionStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "createScopedToken" })).toEqual(newSession);
    expect(sessionStore.get.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls[0][0]).toEqual(newSession);
  });

  it("refresh token", async () => {
    const oldSession = { authentication: { token: "token123" } };
    const newSession = { authentication: { token: "token456" } };

    const sessionStore = {
      get: jest.fn().mockResolvedValue(oldSession),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .patchOnce("http://acme.com/api/github/oauth/refresh-token", newSession, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      clientType: "github-app",
      expirationEnabled: true,
      sessionStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "refreshToken" })).toEqual(newSession);
    expect(sessionStore.get.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls[0][0]).toEqual(newSession);
  });

  it("reset token", async () => {
    const oldSession = { authentication: { token: "token123" } };
    const newSession = { authentication: { token: "token456" } };

    const sessionStore = {
      get: jest.fn().mockResolvedValue(oldSession),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .patchOnce("http://acme.com/api/github/oauth/token", newSession, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "resetToken" })).toEqual(newSession);
    expect(sessionStore.get.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls.length).toBe(1);
    expect(sessionStore.set.mock.calls[0][0]).toEqual(newSession);
  });

  it("delete token", async () => {
    const session = { authentication: { token: "token123" } };

    const sessionStore = {
      get: jest.fn().mockResolvedValue(session),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .deleteOnce("http://acme.com/api/github/oauth/token", 200, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "deleteToken" })).toBeNull();
    expect(sessionStore.get.mock.calls.length).toEqual(1);
    expect(sessionStore.set.mock.calls.length).toEqual(1);
    expect(sessionStore.set.mock.calls[0][0]).toBeNull();
  });

  it("delete token (offline)", async () => {
    const session = { authentication: { token: "token123" } };

    const sessionStore = {
      get: jest.fn().mockResolvedValue(session),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
    });

    expect(await auth({ type: "deleteToken", offline: true })).toBeNull();
    expect(sessionStore.get.mock.calls.length).toEqual(1);
    expect(sessionStore.set.mock.calls.length).toEqual(1);
    expect(sessionStore.set.mock.calls[0][0]).toBeNull();
  });

  it("delete authorization", async () => {
    const session = { authentication: { token: "token123" } };

    const sessionStore = {
      get: jest.fn().mockResolvedValue(session),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const fetch = fetchMock
      .sandbox()
      .deleteOnce("http://acme.com/api/github/oauth/grant", 200, {
        headers: {
          accept: "application/vnd.github.v3+json",
          "user-agent": "test",
          authorization: "token token123",
        },
      });

    const auth = createOAuthUserClientAuth({
      clientId: "clientId123",
      sessionStore,
      request: request.defaults({
        headers: { "user-agent": "test" },
        request: { fetch },
      }),
    });

    expect(await auth({ type: "deleteAuthorization" })).toBeNull();
    expect(sessionStore.get.mock.calls.length).toEqual(1);
    expect(sessionStore.set.mock.calls.length).toEqual(1);
    expect(sessionStore.set.mock.calls[0][0]).toBeNull();
  });
});
