import { describe, expect, test } from "vitest";
import {
  CACHE_IMUTAVEL,
  chavePermitida,
  disposicaoAnexo,
  respostaMidia,
  urlMidia,
  type ObjetoMidia,
} from "./midia";

const CHAVE_ORIGINAL = "_teste/9-recomecar/originais/01ABC.jpg";
const CHAVE_THUMB = "_teste/9-recomecar/derivadas/01ABC/thumb";

describe("urlMidia", () => {
  test("sem base pública devolve a rota Worker", () => {
    expect(urlMidia(CHAVE_THUMB, "")).toBe(`/midia/${CHAVE_THUMB}`);
  });

  test("base pública vira prefixo da URL", () => {
    expect(urlMidia(CHAVE_THUMB, "https://midia.exemplo.com")).toBe(
      `https://midia.exemplo.com/${CHAVE_THUMB}`,
    );
  });

  test("barra final da base não duplica", () => {
    expect(urlMidia(CHAVE_THUMB, "https://midia.exemplo.com/")).toBe(
      `https://midia.exemplo.com/${CHAVE_THUMB}`,
    );
  });

  test("base undefined (var ausente do env) cai na rota Worker", () => {
    expect(urlMidia(CHAVE_THUMB, undefined)).toBe(`/midia/${CHAVE_THUMB}`);
  });
});

describe("chavePermitida", () => {
  test("aceita os prefixos do bucket (produção e teste)", () => {
    expect(chavePermitida("retiros/9-recomecar/derivadas/01A/thumb")).toBe(true);
    expect(chavePermitida(CHAVE_ORIGINAL)).toBe(true);
  });

  test("rejeita prefixo desconhecido e chave vazia", () => {
    expect(chavePermitida("outra/coisa.jpg")).toBe(false);
    expect(chavePermitida("")).toBe(false);
    // prefixo sem barra não é o prefixo: "retirosx/..." não pode passar
    expect(chavePermitida("retirosx/a.jpg")).toBe(false);
  });
});

describe("disposicaoAnexo", () => {
  test("nome ASCII vai direto no filename", () => {
    expect(disposicaoAnexo("IMG_1234.jpg")).toBe(
      'attachment; filename="IMG_1234.jpg"',
    );
  });

  test("nome com acento ganha filename* UTF-8 e fallback ASCII", () => {
    const d = disposicaoAnexo("adoração.jpg");
    expect(d).toContain('filename="adora__o.jpg"');
    expect(d).toContain("filename*=UTF-8''adora%C3%A7%C3%A3o.jpg");
  });

  test("aspas no nome não quebram o quoted-string", () => {
    expect(disposicaoAnexo('a"b.jpg')).toContain('filename="a_b.jpg"');
  });
});

function objeto(sobrescrever: Partial<ObjetoMidia> = {}): ObjetoMidia {
  return {
    httpEtag: '"etag123"',
    body: new Blob(["dados"]).stream(),
    httpMetadata: { contentType: "image/webp" },
    ...sobrescrever,
  };
}

describe("respostaMidia", () => {
  test("objeto inexistente é 404", () => {
    expect(respostaMidia(CHAVE_THUMB, null, null).status).toBe(404);
  });

  test("derivada: 200 com Content-Type do metadata, cache imutável e ETag", async () => {
    const r = respostaMidia(CHAVE_THUMB, objeto(), null);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("image/webp");
    expect(r.headers.get("Cache-Control")).toBe(CACHE_IMUTAVEL);
    expect(r.headers.get("ETag")).toBe('"etag123"');
    expect(r.headers.get("Content-Disposition")).toBeNull();
    expect(await r.text()).toBe("dados");
  });

  test("sem Content-Type no metadata cai em octet-stream", () => {
    const r = respostaMidia(CHAVE_THUMB, objeto({ httpMetadata: {} }), null);
    expect(r.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  test("If-None-Match igual ao ETag devolve 304 sem corpo", () => {
    const r = respostaMidia(CHAVE_THUMB, objeto(), '"etag123"');
    expect(r.status).toBe(304);
    expect(r.body).toBeNull();
    expect(r.headers.get("Cache-Control")).toBe(CACHE_IMUTAVEL);
    expect(r.headers.get("ETag")).toBe('"etag123"');
  });

  test("If-None-Match diferente devolve 200 normal", () => {
    const r = respostaMidia(CHAVE_THUMB, objeto(), '"outro"');
    expect(r.status).toBe(200);
  });

  test("original com Content-Disposition gravado no metadata repassa como está", () => {
    const gravado = "attachment; filename=\"IMG_1234.jpg\"";
    const r = respostaMidia(
      CHAVE_ORIGINAL,
      objeto({ httpMetadata: { contentType: "image/jpeg", contentDisposition: gravado } }),
      null,
    );
    expect(r.headers.get("Content-Disposition")).toBe(gravado);
  });

  test("original SEM metadata força attachment com o basename da chave", () => {
    // cobre originais enviados antes do upload gravar o metadata
    const r = respostaMidia(
      CHAVE_ORIGINAL,
      objeto({ httpMetadata: { contentType: "image/jpeg" } }),
      null,
    );
    expect(r.headers.get("Content-Disposition")).toBe(
      'attachment; filename="01ABC.jpg"',
    );
  });
});
