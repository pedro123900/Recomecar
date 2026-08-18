import { describe, expect, test } from "vitest";
import { chaveOriginal, chavesDerivadas } from "./chaves-r2";

describe("convenção de chaves R2 (ratificada)", () => {
  test("original: <prefixo>/<slug>/originais/<id>.<ext>", () => {
    expect(chaveOriginal("retiros", "99-recomecar", "ABC", "jpg")).toBe(
      "retiros/99-recomecar/originais/ABC.jpg",
    );
  });

  test("derivadas são função pura da chave do original, sem extensão", () => {
    expect(chavesDerivadas("retiros/99-recomecar/originais/ABC.jpg")).toEqual({
      thumb: "retiros/99-recomecar/derivadas/ABC/thumb",
      media: "retiros/99-recomecar/derivadas/ABC/media",
      poster: "retiros/99-recomecar/derivadas/ABC/poster",
    });
  });

  test("prefixo _teste (e2e) atravessa sem caso especial", () => {
    expect(chavesDerivadas("_teste/99-recomecar/originais/ABC.png").thumb).toBe(
      "_teste/99-recomecar/derivadas/ABC/thumb",
    );
  });

  test("chave fora da convenção lança", () => {
    expect(() => chavesDerivadas("qualquer/coisa.jpg")).toThrow();
  });
});
