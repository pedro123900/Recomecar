import { Link } from "react-router";
import type { Route } from "./+types/capa";
import { GradeFotos } from "~/componentes/grade-fotos";
import { contextoCloudflare } from "~/lib/contexto";
import { amostraEstavel, dataPorExtensoPtBr } from "~/lib/galeria";
import {
  carregarRetiroPublicado,
  eventosComFotos,
  idsPorEvento,
  idsPorMomento,
  itensPorIds,
} from "~/lib/retiro-publico.server";

const AMOSTRA_EVENTO = 2;

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.retiro.titulo ?? "Retiro"} — Grupo Recomeçar` },
    // galeria fica fora do índice de busca (CLAUDE.md: noindex, fora do sitemap)
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const { env } = context.get(contextoCloudflare);
  const retiro = await carregarRetiroPublicado(env.DB, params.edicao);

  const ids = await idsPorMomento(env.DB, retiro);
  // destaques provisórios: amostra estável do acervo até o álbum
  // "Instagramáveis" existir (Bloco C troca só a fonte)
  const idsDestaques = amostraEstavel(
    ids.map((f) => f.id),
    2,
    `destaques:${retiro.slug}`,
  );
  const destaques = await itensPorIds(
    env.DB,
    retiro,
    idsDestaques,
    env.MIDIA_URL_PUBLICA,
  );

  // Preparação: eventos com foto, cada um com amostra estável
  const eventos = await eventosComFotos(env.DB, retiro);
  const idsEventos = await idsPorEvento(env.DB, retiro);
  const porEvento = new Map<number, number[]>();
  for (const f of idsEventos) {
    const lista = porEvento.get(f.evento_id) ?? [];
    lista.push(f.id);
    porEvento.set(f.evento_id, lista);
  }
  const idsAmostras = eventos.flatMap((e) =>
    amostraEstavel(
      porEvento.get(e.id) ?? [],
      AMOSTRA_EVENTO,
      `preparacao:${retiro.slug}:${e.id}`,
    ),
  );
  const itensAmostras = await itensPorIds(
    env.DB,
    retiro,
    idsAmostras,
    env.MIDIA_URL_PUBLICA,
  );
  const itemPorId = new Map(itensAmostras.map((i) => [i.id, i]));
  const preparacao = eventos.map((e) => ({
    ...e,
    amostra: (porEvento.get(e.id) ?? [])
      .filter((id) => itemPorId.has(id))
      .map((id) => itemPorId.get(id)!),
  }));

  return { retiro, total: ids.length, destaques, preparacao };
}

export default function Capa({ loaderData }: Route.ComponentProps) {
  const { retiro, total, destaques, preparacao } = loaderData;
  const base = `/retiros/${retiro.slug}`;
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

      {destaques.length > 0 && (
        <section aria-label="Destaques" className="mt-6">
          <h2 className="text-xl font-bold">Destaques</h2>
          <GradeFotos
            itens={destaques}
            urlItem={(item) => `${base}/fotos?foto=${item.id}`}
          />
        </section>
      )}

      {preparacao.length > 0 && (
        <section aria-label="Preparação" className="mt-6">
          <h2 className="text-xl font-bold">Preparação</h2>
          {preparacao.map((evento) => (
            <section
              key={evento.id}
              aria-label={evento.nome}
              className="mt-4"
            >
              <h3 className="font-bold">{evento.nome}</h3>
              <p className="text-sm">{dataPorExtensoPtBr(evento.data)}</p>
              <GradeFotos
                itens={evento.amostra}
                urlItem={(item) =>
                  `${base}/fotos?evento=${evento.id}&foto=${item.id}`
                }
              />
              <p className="mt-1">
                <Link
                  to={`${base}/fotos?evento=${evento.id}`}
                  className="underline"
                >
                  Ver todas ({evento.total})
                </Link>
              </p>
            </section>
          ))}
        </section>
      )}

      <nav aria-label="Visões da galeria" className="mt-6">
        <ul className="grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
          <li>
            <Link
              to={`${base}/pastas`}
              className="block border p-4 text-lg underline"
            >
              Ver por pastas
            </Link>
          </li>
          <li>
            <Link
              to={`${base}/linha-do-tempo`}
              className="block border p-4 text-lg underline"
            >
              Linha do tempo
            </Link>
          </li>
        </ul>
        <p className="mt-2">
          <Link to={`${base}/fotos`} className="text-sm underline">
            Todas as fotos ({total})
          </Link>
        </p>
      </nav>
    </main>
  );
}
