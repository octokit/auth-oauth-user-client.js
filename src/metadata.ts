import { getUserAgent } from "universal-user-agent";
export const NAME = "@octokit/auth-oauth-user-client.js";
export const VERSION = "0.0.0-development";
export const userAgent = `${NAME}/${VERSION} ${getUserAgent()}`;
