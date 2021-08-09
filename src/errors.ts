import { NAME } from "./metadata";

const messages = {
  oauthAppDoesNotSupportTokenExpiration:
    "OAuth App does not support token expiration.",
  basicAuthIsUnsupported: "Basic authentication is unsupported.",
  codeOrStateMissing: 'Both "code" & "state" parameters are required.',
  stateMismatch: "State mismatch.",
  unauthorized: "Unauthorized",
};

const errors = Object.entries(messages).reduce((errors, [key, message]) => {
  errors[key as keyof typeof messages] = new Error(`[${NAME}] ${message}`);
  return errors;
}, {} as Record<keyof typeof messages, Error>);

export default errors;
