import {
  EndpointDefaults,
  EndpointOptions,
  OctokitResponse,
  RequestInterface,
  RequestParameters,
  Route,
} from "@octokit/types";
import { AuthOptions } from "./types";

type AnyResponse = OctokitResponse<any>;

export async function hook(
  options: AuthOptions,
  request: RequestInterface,
  route: Route | EndpointOptions,
  parameters: RequestParameters = {}
): Promise<AnyResponse> {
  // TODO: add implementation
  //       probably something like setting the authorization header
  return request(route, parameters);
}
