/**
 * @jest-environment jsdom
 */

import { Octokit } from "@octokit/core";
import fetchMock, { MockMatcherFunction } from "fetch-mock";
import { createOAuthUserClientAuth } from "../src/index";

describe("standalone tests under jsdom environment", () => {
  it("get token (unauthorized)", async () => {
    const octokit = new Octokit({
      authStrategy: createOAuthUserClientAuth,
      auth: { clientId: "clientId123" },
    });

    expect(await octokit.auth()).toBeNull();
  });

  it("GET /user (unauthorized)", async () => {
    const matchGetUserRequest: MockMatcherFunction = (url, options) => {
      expect(url).toEqual("https://api.github.com/user");
      expect(options.headers).toEqual(
        expect.objectContaining({ accept: "application/vnd.github.v3+json" })
      );

      return true;
    };

    const fetch = fetchMock
      .sandbox()
      .getOnce(matchGetUserRequest, { login: "octocat" });

    const octokit = new Octokit({
      authStrategy: createOAuthUserClientAuth,
      auth: { clientId: "clientId123" },
      request: { fetch },
    });

    const { data: user } = await octokit.request("GET /user");
    expect(user.login).toEqual("octocat");
  });

  it("GET /user (authorized)", async () => {
    const matchGetUserRequest: MockMatcherFunction = (url, options) => {
      expect(url).toEqual("https://api.github.com/user");
      expect(options.headers).toEqual(
        expect.objectContaining({
          accept: "application/vnd.github.v3+json",
          authorization: "token token123",
        })
      );

      return true;
    };

    const fetch = fetchMock
      .sandbox()
      .getOnce(matchGetUserRequest, { login: "octocat" });

    const octokit = new Octokit({
      authStrategy: createOAuthUserClientAuth,
      auth: {
        clientId: "clientId123",
        session: { authentication: { token: "token123" } },
      },
      request: { fetch },
    });

    const { data: user } = await octokit.request("GET /user");
    expect(user.login).toEqual("octocat");
  });

  it("basic authentication is unsupported", async () => {
    const octokit = new Octokit({
      authStrategy: createOAuthUserClientAuth,
      auth: {
        clientId: "clientId123",
        stateStore: false,
        sessionStore: false,
      },
    });

    await expect(
      async () =>
        await octokit.request("POST /applications/{client_id}/token", {
          client_id: "clientId123",
          access_token: "token123",
        })
    ).rejects.toThrow(
      "[@octokit/auth-oauth-user-client.js] Basic authentication is unsupported."
    );
  });

  it("sets no auth auth for OAuth Web flow requests", async () => {
    const matchCreateTokenRequest: MockMatcherFunction = (url, options) => {
      expect(url).toEqual("https://github.com/login/oauth/access_token");
      // @ts-ignore
      expect(options.headers.authorization).toBeUndefined();

      return true;
    };

    const mock = fetchMock
      .sandbox()
      .postOnce(matchCreateTokenRequest, { ok: true });

    const octokit = new Octokit({
      authStrategy: createOAuthUserClientAuth,
      auth: {
        clientId: "clientId123",
        session: { authentication: { token: "token123" } },
      },
      request: {
        fetch: mock,
      },
    });

    const { data } = await octokit.request(
      "POST https://github.com/login/oauth/access_token",
      {
        client_id: "1234567890abcdef1234",
        client_secret: "client_secret",
        code: "code123",
      }
    );

    expect(data).toEqual({ ok: true });
  });
});
