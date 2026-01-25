import { describe, expect, it } from "bun:test";

import { interpolate } from "./interpolate.js";

describe("interpolate", () => {
  it("replaces known placeholders", () => {
    expect(interpolate("Hello {{name}}", { name: "Ada" })).toBe("Hello Ada");
  });

  it("leaves unknown placeholders intact", () => {
    expect(interpolate("Hello {{name}} {{unknown}}", { name: "Ada" })).toBe(
      "Hello Ada {{unknown}}",
    );
  });

  it("supports keys with separators", () => {
    expect(interpolate("Hello {{user.name}}", { "user.name": "Ada" })).toBe(
      "Hello Ada",
    );
  });

  it("supports escaping literal braces", () => {
    expect(interpolate("Show \\{{name}} and {{name}}", { name: "Ada" })).toBe(
      "Show {{name}} and Ada",
    );
  });
});
