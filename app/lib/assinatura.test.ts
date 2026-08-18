import { describe, expect, test } from "vitest";
import { assinarPut } from "./assinatura.server";

// Credenciais FALSAS de teste — a assinatura é matemática local (SigV4),
// nenhuma chamada de rede acontece aqui.
const envFalso = {
  CF_ACCOUNT_ID: "conta123",
  R2_BUCKET: "recomecar-media",
  R2_ACCESS_KEY_ID: "AKfalso",
  R2_SECRET_ACCESS_KEY: "segredofalso",
} as unknown as Env;

describe("assinarPut", () => {
  test("URL aponta para a chave no endpoint do R2 e carrega assinatura SigV4", async () => {
    const url = new URL(
      await assinarPut(envFalso, "_teste/x/originais/A.jpg"),
    );
    expect(url.hostname).toBe("conta123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/recomecar-media/_teste/x/originais/A.jpg");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
  });

  test("chaves diferentes assinam diferente (a assinatura cobre o caminho)", async () => {
    const a = new URL(await assinarPut(envFalso, "_teste/x/originais/A.jpg"));
    const b = new URL(await assinarPut(envFalso, "_teste/x/originais/B.jpg"));
    expect(a.searchParams.get("X-Amz-Signature")).not.toBe(
      b.searchParams.get("X-Amz-Signature"),
    );
  });
});
