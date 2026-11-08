import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./lazyReload";

describe("isChunkLoadError", () => {
  it("detects dynamic import failures", () => {
    expect(
      isChunkLoadError(
        new TypeError(
          "error loading dynamically imported module: https://example/assets/PianoTab-old.js",
        ),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new Error("Loading chunk 5 failed"))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of null"))).toBe(false);
  });
});
