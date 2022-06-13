import { endpoints } from "./endpoints.ts";
import { NAME, VERSION } from "./metadata.ts";
import type { AuthenticatorState, ClientTypes } from "./types.ts";

export const fetchOAuthApp = async <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
>(
  state: AuthenticatorState<ClientType, ExpirationEnabled>,
  command: keyof typeof endpoints,
  token: string | null,
  body: Record<string, unknown> | null,
) => {
  const [method, path] = endpoints[command];
  const headers: Record<string, string> = {
    "user-agent": `${NAME}/${VERSION} ${navigator.userAgent}`,
    ...(token ? { authorization: "token " + token } : {}),
    ...(body ? { "content-type": "application/json; charset=utf-8" } : {}),
    accept: "application/json",
  };
  const route = state.serviceOrigin + state.servicePathPrefix + path;
  const { fetch } = state;
  const response = await fetch(route, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return null;
  return await response.json();
};
