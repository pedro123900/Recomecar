import type { Route } from "./+types/retiro";
import { contextoCloudflare } from "~/lib/contexto";
import {
  dataPorExtensoPtBr,
  itemGaleria,
  type LinhaFotoGaleria,
} from "~/lib/galeria";
import type { Retiro } from "~/lib/tipos";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.retiro.titulo ?? "Retiro"} — Grupo Recomeçar` },
    // galeria fica fora do índice de busca (CLAUDE.md: noindex, fora do sitemap)
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const { env } = context.get(contextoCloudflare);
  // página pública: edição não publicada não existe para fora
  const retiro = await env.DB.prepare(
    "SELECT * FROM retiros WHERE slug = ? AND publicado = 1",
  )
    .bind(params.edicao)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });

  // ordem cronológica; sem data de captura (vídeos desta fase) vai ao fim
  const { results } = await env.DB.prepare(
    `SELECT f.id, f.arquivo_r2, f.tipo, f.largura, f.altura, f.duracao,
            m.nome AS momento_nome, m.dia AS momento_dia
       FROM fotos f
       LEFT JOIN momentos m ON m.id = f.momento_id
      WHERE f.retiro_id = ?
      ORDER BY (f.capturada_em IS NULL), f.capturada_em, f.id`,
  )
    .bind(retiro.id)
    .all<LinhaFotoGaleria>();

  return {
    retiro,
    itens: results.map((linha) =>
      itemGaleria(linha, retiro.titulo, env.MIDIA_URL_PUBLICA),
    ),
  };
}

export default function Retiro({ loaderData }: Route.ComponentProps) {
  const { retiro, itens } = loaderData;
  return (
    <main className="mx-auto max-w-5xl p-4">
      <header>
        <h1 className="text-2xl font-bold">{retiro.titulo}</h1>
        <p>
          Série {retiro.serie} · nº {retiro.numero}
        </p>
        <p>
          De {dataPorExtensoPtBr(retiro.data_dia1)} a{" "}
          {dataPorExtensoPtBr(retiro.data_dia3)}
          {retiro.data_pre && (
            <> · Pré-retiro: {dataPorExtensoPtBr(retiro.data_pre)}</>
          )}
        </p>
        {retiro.padroeiro_nome && (
          <p>
            Sob a proteção de {retiro.padroeiro_nome}
            {retiro.padroeiro_invocacao && <> — {retiro.padroeiro_invocacao}</>}
          </p>
        )}
      </header>

      <section aria-label="Galeria de fotos e vídeos" className="mt-6">
        <h2 className="text-xl font-bold">
          Galeria{itens.length > 0 && <> ({itens.length})</>}
        </h2>
        {itens.length === 0 ? (
          <p>Nenhuma foto ou vídeo publicado ainda.</p>
        ) : (
          <ul className="galeria mt-3 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 md:grid-cols-4">
            {itens.map((item) => (
              <li key={item.id} className="galeria-item">
                <figure>
                  <img
                    src={item.urlExibicao}
                    alt={item.alt}
                    width={item.largura}
                    height={item.altura}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full"
                  />
                  <figcaption className="text-sm">
                    {item.tipo === "video" && <span aria-hidden="true">▶ </span>}
                    {item.legenda} ·{" "}
                    <a href={item.urlDownload} className="underline">
                      Baixar original
                    </a>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
