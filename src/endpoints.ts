// TODO: better defined in `oauth-app.js`
export const endpoints = {
  createToken: ["POST", "/token"],
  checkToken: ["GET", "/token"],
  createScopedToken: ["POST", "/token/scoped"],
  resetToken: ["PATCH", "/token"],
  renewToken: ["PATCH", "/refresh-token"],
  deleteToken: ["DELETE", "/token"],
  deleteAuthorization: ["DELETE", "/grant"],
} as const;
