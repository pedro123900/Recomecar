import { describe, expect, test } from "vitest";
import { ulid } from "./ulid";

describe("ulid", () => {
  test("26 caracteres do alfabeto Crockford", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test("prefixo temporal ordena: timestamp maior => string maior", () => {
    expect(ulid(2_000_000_000_000) > ulid(1_000_000_000_000)).toBe(true);
  });

  test("duas chamadas no mesmo instante diferem (parte aleatória)", () => {
    expect(ulid(1_000_000_000_000)).not.toBe(ulid(1_000_000_000_000));
  });
});
