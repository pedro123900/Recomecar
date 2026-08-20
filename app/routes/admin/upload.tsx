import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/upload";
import type { FotoParaGravar } from "./upload-acao";
import { contextoCloudflare } from "~/lib/contexto";
import { derivadasDeFoto, derivadasDeVideo } from "~/lib/derivadas.client";
import { lerExif } from "~/lib/exif";
import type { Retiro } from "~/lib/tipos";

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

// As ações vivem na resource route irmã (upload-acao.ts, POST em
// ./acao): rota com componente devolveria o HTML do documento num POST
// puro. O cliente orquestra assinar -> PUTs no R2 -> gravar.

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
      fetch(`${window.location.pathname}/acao`, {
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
