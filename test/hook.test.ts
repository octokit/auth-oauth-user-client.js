import { Octokit } from "octokit";
import { createOAuthUserClientAuth } from "../src/index.ts";
import { AuthStrategyOptions, GitHubApp } from "../src/types.ts";
import { createServerResponse } from "./utils.ts";
import { assert, assertRejects } from "std/testing/asserts.ts";
import { returnsNext, stub } from "std/testing/mock.ts";

const gitHubAppExpirationDisabledAuth = {
  tokenType: "oauth",
  type: "token",
  clientId: "client_id",
  clientType: "github-app",
  token: "token_123",
} as const;

const githubApp = "github-app";
const clientId = "client_id";

Deno.test("can not perform basic authentication", async () => {
  const clientAuthOptions: AuthStrategyOptions<GitHubApp, false> = {
    clientId,
    clientType: githubApp,
    expirationEnabled: false,
    auth: gitHubAppExpirationDisabledAuth,
  };

  const octokit = new Octokit({
    authStrategy: createOAuthUserClientAuth,
    auth: clientAuthOptions,
  });

  await assertRejects(
    () => octokit.rest.apps.checkToken(),
    Error,
    "Basic authentication is unsupported.",
  );

  localStorage.clear();
});

Deno.test("do not intercept oauth web flow requests", async () => {
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

  await octokit.request("GET /login/oauth/access_token");
  assert(!("authorization" in fetchStub.calls[0].args[1]?.headers!));

  fetchStub.restore();
  localStorage.clear();
});
