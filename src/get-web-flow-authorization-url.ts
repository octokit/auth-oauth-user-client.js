import * as OAuthAuthorizationURL from "@octokit/oauth-authorization-url";
import { ClientType, OAuthApp } from "./types";

// Generic version of `@octokit/oauth-authorization-url`.
export function getWebFlowAuthorizationUrl<Client extends ClientType>(
  options: GetWebFlowAuthorizationUrlOptions<Client>
): GetWebFlowAuthorizationUrlResult<Client> {
  // @ts-ignore
  return OAuthAuthorizationURL.oauthAuthorizationUrl(options);
}

export type GetWebFlowAuthorizationUrlOptions<Client extends ClientType> =
  Client extends OAuthApp
    ? OAuthAuthorizationURL.OAuthAppOptions
    : OAuthAuthorizationURL.GitHubAppOptions;

export type GetWebFlowAuthorizationUrlResult<Client extends ClientType> =
  Client extends OAuthApp
    ? OAuthAuthorizationURL.OAuthAppResult
    : OAuthAuthorizationURL.GitHubAppResult;
