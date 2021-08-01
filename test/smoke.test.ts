import { createOAuthUserClientAuth } from "../src";

describe("smoke test", () => {
  it("createOAuthUserAuth is a function", () => {
    expect(createOAuthUserClientAuth).toBeInstanceOf(Function);
  });

  it("createOAuthUserClientAuth.VERSION is set", () => {
    expect(createOAuthUserClientAuth.VERSION).toEqual("0.0.0-development");
  });

  it("requiresBasicAuth is a function", () => {
    expect(createOAuthUserClientAuth).toBeInstanceOf(Function);
  });
});
