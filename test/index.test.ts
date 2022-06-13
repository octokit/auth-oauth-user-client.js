import { Octokit } from "octokit";
import { createOAuthUserClientAuth } from "../src/index.ts";
import { AuthStrategyOptions, GitHubApp } from "../src/types.ts";
import { createServerResponse } from "./utils.ts";
import {
  assertEquals,
  assertObjectMatch,
  assertThrows,
} from "std/testing/asserts.ts";
import { returnsNext, stub } from "std/testing/mock.ts";

const gitHubAppExpirationDisabledAuth = {
  tokenType: "oauth",
  type: "token",
  clientId: "client_id",
  clientType: "github-app",
  token: "token_123",
} as const;

const oauthApp = "oauth-app";
const githubApp = "github-app";
const clientId = "client_id";

Deno.test("expiration disabled for oauth app currently", () => {
  assertThrows(
    () =>
      createOAuthUserClientAuth({
        clientId,
        clientType: oauthApp,
        expirationEnabled: true,
      }),
    Error,
    "OAuth App does not support token expiration.",
  );
});

Deno.test("get authenticated user", async () => {
  const userServer = { foo: "bar" };
  const response = createServerResponse(userServer);
  const fetchStub = stub(window, "fetch", returnsNext([response]));

  const clientAuthOptions: AuthStrategyOptions<GitHubApp, false> = {
    clientId,
    clientType: githubApp,
    expirationEnabled: false,
    auth: gitHubAppExpirationDisabledAuth,
  };

  const octokit = new Octokit({
    authStrategy: createOAuthUserClientAuth,
    auth: clientAuthOptions,
    request: { fetch: fetchStub },
  });

  assertEquals(localStorage.length, 1);

  const { data: userClient } = await octokit.rest.users.getAuthenticated();

  assertEquals(userClient, userServer);
  assertEquals(fetchStub.calls[0].args[0], "https://api.github.com/user");
  assertObjectMatch(fetchStub.calls[0].args[1]!, {
    method: "GET",
    headers: {
      accept: "application/vnd.github.v3+json",
      authorization: `token ${gitHubAppExpirationDisabledAuth.token}`,
    },
  });

  fetchStub.restore();
  localStorage.clear();
});
