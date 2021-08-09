/**
 * @jest-environment jsdom
 */

import { createStore } from "../src/create-store";

describe("create store", () => {
  it("create string store", async () => {
    const stringStore = createStore("STRING");
    expect(await stringStore.get()).toBeNull();

    await stringStore.set("value");
    expect(await stringStore.get()).toBe("value");

    await stringStore.set(null);
    expect(await stringStore.get()).toBeNull();

    await stringStore.set("");
    expect(await stringStore.get()).toBe("");

    await stringStore.set(undefined);
    expect(await stringStore.get()).toBeNull();
  });

  it("create object store", async () => {
    const objectStore = createStore("OBJECT");
    expect(await objectStore.get()).toBeNull();

    await objectStore.set({ foo: "bar" });
    expect(await objectStore.get()).toEqual({ foo: "bar" });

    await objectStore.set(null);
    expect(await objectStore.get()).toBeNull();

    await objectStore.set(undefined);
    expect(await objectStore.get()).toBeNull();
  });
});
