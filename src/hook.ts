import { requiresBasicAuth } from "./requires-basic-auth.ts";
import type { Auth, ClientTypes } from "./types.ts";
import type {
  EndpointDefaults,
  EndpointOptions,
  OctokitResponse,
  RequestInterface,
  RequestParameters,
  Route,
} from "@octokit/types";

export const hook = <
  ClientType extends ClientTypes,
  ExpirationEnabled extends boolean,
>(_auth: () => Promise<Auth<ClientType, ExpirationEnabled> | null>): <T>(
  request: RequestInterface,
  route: Route | EndpointOptions,
  parameters: RequestParameters,
) => Promise<AnyResponse<T>> => {
  return async <T>(
    request: RequestInterface,
    route: Route | EndpointOptions,
    parameters: RequestParameters = {},
  ): Promise<AnyResponse<T>> => {
    const endpoint = request.endpoint.merge(
      route as string,
      parameters,
    ) as EndpointDefaults & { url: string };

    // unable to perform basic authentication since client secret is missing
    if (requiresBasicAuth(endpoint.url)) {
      throw Error("Basic authentication is unsupported.");
    }

    // do not intercept OAuth Web flow requests
    const oauthWebFlowUrls = /\/login\/(oauth\/access_token|device\/code)$/;
    if (!oauthWebFlowUrls.test(endpoint.url)) {
      const auth = await _auth();
      const token = auth?.token;
      if (token) endpoint.headers.authorization = "token " + token;
    }

    return request(endpoint);
  };
};

type AnyResponse<T> = OctokitResponse<T>;
