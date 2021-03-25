import { createOAuthUserClientAuth } from "../src";

describe("Smoke test", () => {
  it("is a function", () => {
    expect(createOAuthUserClientAuth).toBeInstanceOf(Function);
  });

  it("createOAuthUserClientAuth.VERSION is set", () => {
    expect(createOAuthUserClientAuth.VERSION).toEqual("0.0.0-development");
  });
});
