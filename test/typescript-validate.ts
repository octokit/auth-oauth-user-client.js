import { createOAuthUserClientAuth } from "../src";

async () => {
  const auth = createOAuthUserClientAuth({ clientId: "clientId123" });
  const session = await auth();
  session?.authentication.clientType === "oauth-app";
  session?.authentication.token;
  session?.authentication.scopes;
  // @ts-expect-error OAuth App does not support token expiration.
  session.authentication.expiresAt;
  // @ts-expect-error Token expiration is disabled.
  await auth({ type: "refreshToken" });
};

async () => {
  const auth = createOAuthUserClientAuth({
    clientId: "clientId123",
    clientType: "oauth-app",
    defaultScopes: [],
  });
  const session = await auth();
  session?.authentication.clientType === "oauth-app";
  session?.authentication.token;
  session?.authentication.scopes;
  // @ts-expect-error OAuth App does not support token expiration.
  session?.authentication.expiresAt;
  // @ts-expect-error Token expiration is disabled.
  await auth({ type: "refreshToken" });
};

async () => {
  const auth = createOAuthUserClientAuth({
    clientId: "clientId123",
    clientType: "github-app",
    // @ts-expect-error
    defaultScopes: [],
  });
  const session = await auth();
  session?.authentication.clientType === "github-app";
  session?.authentication.token;
  session?.authentication.expiresAt;
  // @ts-expect-error GitHub App has no `scopes` in `authentication`.
  session?.authentication.scopes;
  await auth({ type: "refreshToken" });
};

async () => {
  const auth = createOAuthUserClientAuth({
    clientId: "clientId123",
    clientType: "github-app",
    expirationEnabled: false,
    // @ts-expect-error `defaultScopes` only allowed for OAuth App.
    defaultScopes: [],
  });
  const session = await auth();
  session?.authentication.clientType === "github-app";
  session?.authentication.token;
  // @ts-expect-error Token expiration is disabled.
  session.expiresAt;
  // @ts-expect-error GitHub App has no `scopes` in `authentication`.
  session.scopes;
  // @ts-expect-error Token expiration is disabled.
  await auth({ type: "refreshToken" });
};
