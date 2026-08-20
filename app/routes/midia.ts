import type { Route } from "./+types/midia";
import { contextoCloudflare } from "~/lib/contexto";
import { chavePermitida, respostaMidia } from "~/lib/midia";

// Resource route /midia/* — o modo Worker de servir mídia (CLAUDE.md,
// "Como a mídia é servida"): lê o binding e responde com cache imutável.
// Em produção com domínio próprio, MIDIA_URL_PUBLICA aponta o navegador
// direto ao bucket e esta rota fica como suporte (dev/e2e e download).
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const chave = params["*"];
  if (!chavePermitida(chave)) {
    return new Response("Não encontrado", { status: 404 });
  }
  const { env } = context.get(contextoCloudflare);
  const objeto = await env.MEDIA.get(chave);
  return respostaMidia(chave, objeto, request.headers.get("If-None-Match"));
}
