import { Link } from "react-router";
import type { Route } from "./+types/capa";
import { GradeFotos } from "~/componentes/grade-fotos";
import { contextoCloudflare } from "~/lib/contexto";
import { amostraEstavel, dataPorExtensoPtBr } from "~/lib/galeria";
import {
  carregarRetiroPublicado,
  idsPorMomento,
  itensPorIds,
} from "~/lib/retiro-publico.server";

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

  return { retiro, total: ids.length, destaques };
}

export default function Capa({ loaderData }: Route.ComponentProps) {
  const { retiro, total, destaques } = loaderData;
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
