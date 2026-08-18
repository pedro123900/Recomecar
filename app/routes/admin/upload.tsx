import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/upload";
import { assinarPut, prefixoR2 } from "~/lib/assinatura.server";
import { chaveOriginal, chavesDerivadas } from "~/lib/chaves-r2";
import { contextoCloudflare } from "~/lib/contexto";
import { derivadasDeFoto, derivadasDeVideo } from "~/lib/derivadas.client";
import { lerExif } from "~/lib/exif";
import { atribuirMomento, type JanelaMomento } from "~/lib/motor";
import type { Retiro } from "~/lib/tipos";
import { ulid } from "~/lib/ulid";

export function meta() {
  return [{ title: "Upload — Grupo Recomeçar" }];
}

async function carregarRetiro(db: D1Database, slug: string): Promise<Retiro> {
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(slug)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });
  return retiro;
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const retiro = await carregarRetiro(db, params.edicao);
  return { retiro };
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

interface FotoParaGravar {
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

// As ações respondem Response.json e são chamadas por fetch puro (sem RR
// Form): o cliente orquestra assinar -> PUTs no R2 -> gravar.
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
    const itens = [];
    const comandos = [];
    for (const f of corpo.fotos ?? []) {
      const momentoId = atribuirMomento(f.capturadaEm, momentos);
      comandos.push(
        env.DB.prepare(
          `INSERT INTO fotos (retiro_id, arquivo_r2, tipo, capturada_em,
             momento_id, largura, altura, duracao, aparelho_marca,
             aparelho_modelo, aparelho_serial)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          retiro.id,
          f.chaveOriginal,
          f.tipo,
          f.capturadaEm,
          momentoId,
          f.largura,
          f.altura,
          f.duracao,
          f.marca,
          f.modelo,
          f.serial,
        ),
      );
      itens.push({ chaveOriginal: f.chaveOriginal, momentoId });
    }
    if (comandos.length > 0) await env.DB.batch(comandos);
    return Response.json({ gravadas: comandos.length, itens });
  }

  return Response.json({ erro: "Ação desconhecida." }, { status: 400 });
}

type Estado = { nome: string; fase: string };

export default function AdminUpload({ loaderData }: Route.ComponentProps) {
  const { retiro } = loaderData;
  const [estados, setEstados] = useState<Estado[]>([]);
  const [enviando, setEnviando] = useState(false);

  const atualizar = (i: number, fase: string) =>
    setEstados((es) => es.map((e, j) => (j === i ? { ...e, fase } : e)));

  async function enviar(arquivos: FileList) {
    setEnviando(true);
    const lista = [...arquivos];
    setEstados(lista.map((f) => ({ nome: f.name, fase: "aguardando" })));

    const chamarAcao = (payload: unknown) =>
      fetch(window.location.pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

    const { itens } = (await chamarAcao({
      intent: "assinar",
      arquivos: lista.map((f) => ({ nome: f.name, mime: f.type })),
    })) as {
      itens: {
        erro?: string;
        chaveOriginal?: string;
        urls?: { original: string; thumb: string; media?: string; poster?: string };
      }[];
    };

    const gravar: FotoParaGravar[] = [];
    const indicePorChave: Record<string, number> = {};

    for (let i = 0; i < lista.length; i++) {
      const arquivo = lista[i];
      const item = itens[i];
      if (!item || item.erro || !item.urls || !item.chaveOriginal) {
        atualizar(i, `erro: ${item?.erro ?? "assinatura falhou"}`);
        continue;
      }
      try {
        atualizar(i, "lendo EXIF e gerando derivadas");
        const ehVideo = arquivo.type.startsWith("video/");
        // vídeo: data fica NULL nesta fase (campo EXIF de vídeo será testado
        // com o equipamento real — CLAUDE.md); nada de inventar data
        const exif = ehVideo
          ? { capturadaEm: null, marca: null, modelo: null, serial: null }
          : await lerExif(arquivo);

        const put = (url: string, corpo: Blob | File, tipo: string) =>
          fetch(url, {
            method: "PUT",
            headers: { "Content-Type": tipo },
            body: corpo,
          }).then((r) => {
            if (!r.ok) throw new Error(`PUT ${r.status}`);
          });

        atualizar(i, "enviando ao R2");
        if (ehVideo) {
          const d = await derivadasDeVideo(arquivo);
          await put(item.urls.original, arquivo, arquivo.type);
          await put(item.urls.thumb, d.thumb.blob, d.thumb.contentType);
          await put(item.urls.poster!, d.poster.blob, d.poster.contentType);
          gravar.push({
            chaveOriginal: item.chaveOriginal,
            tipo: "video",
            capturadaEm: null,
            largura: d.largura,
            altura: d.altura,
            duracao: d.duracao,
            marca: null,
            modelo: null,
            serial: null,
          });
        } else {
          const d = await derivadasDeFoto(arquivo);
          await put(item.urls.original, arquivo, arquivo.type);
          await put(item.urls.thumb, d.thumb.blob, d.thumb.contentType);
          await put(item.urls.media!, d.media.blob, d.media.contentType);
          gravar.push({
            chaveOriginal: item.chaveOriginal,
            tipo: "foto",
            capturadaEm: exif.capturadaEm,
            largura: d.largura,
            altura: d.altura,
            duracao: null,
            marca: exif.marca,
            modelo: exif.modelo,
            serial: exif.serial,
          });
        }
        indicePorChave[item.chaveOriginal] = i;
        atualizar(i, "enviado — gravando no banco");
      } catch (e) {
        atualizar(i, `erro: ${String(e)}`);
      }
    }

    if (gravar.length > 0) {
      const r = (await chamarAcao({ intent: "gravar", fotos: gravar })) as {
        itens: { chaveOriginal: string; momentoId: number | null }[];
      };
      for (const g of r.itens) {
        const i = indicePorChave[g.chaveOriginal];
        atualizar(
          i,
          g.momentoId === null
            ? "gravado — Geral/Bastidores"
            : `gravado — momento ${g.momentoId}`,
        );
      }
    }
    setEnviando(false);
  }

  return (
    <main>
      <h1>Upload — {retiro.titulo}</h1>
      <p>
        <Link to="/admin/retiros">← Retiros</Link>
      </p>
      <p>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          disabled={enviando}
          onChange={(e) => e.target.files?.length && enviar(e.target.files)}
        />
      </p>
      <ul>
        {estados.map((e, i) => (
          <li key={i}>
            {e.nome} — {e.fase}
          </li>
        ))}
      </ul>
      <p>
        <small>
          Sem campo nenhum: o EXIF é lido do arquivo e o momento vem do
          cronograma. Arquivo sem data utilizável cai em Geral/Bastidores.
        </small>
      </p>
    </main>
  );
}
