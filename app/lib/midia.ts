// Como a mídia é servida (decisão fechada em 20/08/2026, CLAUDE.md):
// destino é URL pública estável do R2; a rota Worker /midia/* é o suporte
// permanente (dev/e2e e produção até o domínio próprio). Tudo passa por
// urlMidia(chave, base) — o banco guarda só chaves, nunca URLs.

// A chave tem ULID e o objeto nunca muda: revisita não re-baixa nem re-invoca.
export const CACHE_IMUTAVEL = "public, max-age=31536000, immutable";

export function urlMidia(chave: string, basePublica: string | undefined): string {
  if (!basePublica) return `/midia/${chave}`;
  return `${basePublica.replace(/\/$/, "")}/${chave}`;
}

// A rota só serve os prefixos da convenção de chaves; qualquer outro é 404.
export function chavePermitida(chave: string): boolean {
  return chave.startsWith("retiros/") || chave.startsWith("_teste/");
}

// Content-Disposition de download. Nome fora do ASCII vai em filename*
// (RFC 5987); o filename simples fica com um fallback saneado.
export function disposicaoAnexo(nome: string): string {
  const ascii = nome.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const base = `attachment; filename="${ascii}"`;
  if (ascii === nome) return base;
  const utf8 = encodeURIComponent(nome).replace(/'/g, "%27");
  return `${base}; filename*=UTF-8''${utf8}`;
}

// Subconjunto estrutural de R2ObjectBody de que a resposta depende — mantém
// a função pura e testável fora do runtime de worker.
export interface ObjetoMidia {
  httpEtag: string;
  body: ReadableStream | null;
  httpMetadata?: {
    contentType?: string;
    contentDisposition?: string;
  };
}

export function respostaMidia(
  chave: string,
  objeto: ObjetoMidia | null,
  ifNoneMatch: string | null,
): Response {
  if (!objeto) return new Response("Não encontrado", { status: 404 });

  const headers = new Headers({
    "Cache-Control": CACHE_IMUTAVEL,
    ETag: objeto.httpEtag,
  });
  if (ifNoneMatch === objeto.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  headers.set(
    "Content-Type",
    objeto.httpMetadata?.contentType ?? "application/octet-stream",
  );
  if (chave.includes("/originais/")) {
    // original é download; sem metadata gravado (uploads antigos), força
    // attachment com o basename da chave
    headers.set(
      "Content-Disposition",
      objeto.httpMetadata?.contentDisposition ??
        disposicaoAnexo(chave.split("/").pop()!),
    );
  }
  return new Response(objeto.body, { status: 200, headers });
}
