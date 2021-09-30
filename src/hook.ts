import {
  EndpointOptions,
  EndpointDefaults,
  OctokitResponse,
  RequestInterface,
  RequestParameters,
  Route,
} from "@octokit/types";
import { ClientType, ExpirationType, State } from "./types";
import { auth } from "./auth";
import { requiresBasicAuth } from "./requires-basic-auth";
import errors from "./errors";

type AnyResponse = OctokitResponse<any>;

export async function hook<
  Client extends ClientType,
  Expiration extends ExpirationType
>(
  this: State<Client, Expiration>,
  request: RequestInterface,
  route: Route | EndpointOptions,
  parameters: RequestParameters = {}
): Promise<AnyResponse> {
  const endpoint = request.endpoint.merge(
    route as string,
    parameters
  ) as EndpointDefaults & { url: string };

  // Do not intercept OAuth Web flow requests.
  const oauthWebFlowUrls = /\/login\/(oauth\/access_token|device\/code)$/;
  if (oauthWebFlowUrls.test(endpoint.url)) return request(endpoint);

  // Unable to perform basic authentication since client secret is missing.
  if (requiresBasicAuth(endpoint.url)) throw errors.basicAuthIsUnsupported;

  const session = await auth.call(Object.assign({}, this, { request }));
  const token = session ? session.authentication.token : session;
  if (token) endpoint.headers.authorization = "token " + token;
  return request(endpoint);
}
