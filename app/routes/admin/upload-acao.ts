import type { Route } from "./+types/upload-acao";
import { assinarPut, prefixoR2 } from "~/lib/assinatura.server";
import { chaveOriginal, chavesDerivadas } from "~/lib/chaves-r2";
import { contextoCloudflare } from "~/lib/contexto";
import {
  atribuirTemporal,
  type EventoDia,
  type JanelaMomento,
} from "~/lib/motor";
import type { Retiro } from "~/lib/tipos";
import { ulid } from "~/lib/ulid";

async function carregarRetiro(db: D1Database, slug: string): Promise<Retiro> {
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(slug)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });
  return retiro;
}

const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export interface FotoParaGravar {
  chaveOriginal: string;
  tipo: "foto" | "video";
  capturadaEm: string | null;
  largura: number;
  altura: number;
  duracao: number | null;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
}

// Resource route (sem componente): rota com componente devolve o HTML do
// documento num POST puro, então o JSON das ações precisa viver aqui.
// O cliente (upload.tsx) orquestra assinar -> PUTs no R2 -> gravar.
export async function action({ request, context, params }: Route.ActionArgs) {
  const { env } = context.get(contextoCloudflare);
  const retiro = await carregarRetiro(env.DB, params.edicao);
  const corpo = (await request.json()) as {
    intent: string;
    arquivos?: { nome: string; mime: string }[];
    fotos?: FotoParaGravar[];
  };

  if (corpo.intent === "assinar") {
    const itens = [];
    for (const arq of corpo.arquivos ?? []) {
      const ext = EXT_POR_MIME[arq.mime];
      if (!ext) {
        itens.push({ erro: `Tipo não suportado: ${arq.mime} (${arq.nome})` });
        continue;
      }
      const id = ulid();
      const original = chaveOriginal(prefixoR2(), retiro.slug, id, ext);
      const derivadas = chavesDerivadas(original);
      const ehVideo = arq.mime.startsWith("video/");
      itens.push({
        id,
        chaveOriginal: original,
        urls: {
          original: await assinarPut(env, original),
          thumb: await assinarPut(env, derivadas.thumb),
          ...(ehVideo
            ? { poster: await assinarPut(env, derivadas.poster) }
            : { media: await assinarPut(env, derivadas.media) }),
        },
      });
    }
    return Response.json({ itens });
  }

  if (corpo.intent === "gravar") {
    const { results: momentos } = await env.DB.prepare(
      "SELECT id, inicio, fim FROM momentos WHERE retiro_id = ?",
    )
      .bind(retiro.id)
      .all<JanelaMomento>();
    const { results: eventos } = await env.DB.prepare(
      "SELECT id, data, horario FROM eventos WHERE retiro_id = ?",
    )
      .bind(retiro.id)
      .all<EventoDia>();
    const itens = [];
    const comandos = [];
    for (const f of corpo.fotos ?? []) {
      const { momentoId, eventoId } = atribuirTemporal(
        f.capturadaEm,
        momentos,
        eventos,
      );
      comandos.push(
        env.DB.prepare(
          `INSERT INTO fotos (retiro_id, arquivo_r2, tipo, capturada_em,
             momento_id, evento_id, largura, altura, duracao, aparelho_marca,
             aparelho_modelo, aparelho_serial)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          retiro.id,
          f.chaveOriginal,
          f.tipo,
          f.capturadaEm,
          momentoId,
          eventoId,
          f.largura,
          f.altura,
          f.duracao,
          f.marca,
          f.modelo,
          f.serial,
        ),
      );
      itens.push({ chaveOriginal: f.chaveOriginal, momentoId, eventoId });
    }
    if (comandos.length > 0) await env.DB.batch(comandos);
    return Response.json({ gravadas: comandos.length, itens });
  }

  return Response.json({ erro: "Ação desconhecida." }, { status: 400 });
}
