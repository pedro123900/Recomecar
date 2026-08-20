import { Link } from "react-router";
import type { Route } from "./+types/linha-do-tempo";
import { GradeFotos } from "~/componentes/grade-fotos";
import { contextoCloudflare } from "~/lib/contexto";
import {
  amostraEstavel,
  blocosLinhaDoTempo,
  dataPorExtensoPtBr,
  type ItemGaleria,
} from "~/lib/galeria";
import {
  carregarRetiroPublicado,
  idsPorMomento,
  itensPorIds,
} from "~/lib/retiro-publico.server";

const AMOSTRA = 3;

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `Linha do tempo — ${loaderData?.retiro.titulo ?? "Retiro"} — Grupo Recomeçar`,
    },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const { env } = context.get(contextoCloudflare);
  const retiro = await carregarRetiroPublicado(env.DB, params.edicao);

  const { results: momentos } = await env.DB.prepare(
    `SELECT id, nome, dia, inicio, musica FROM momentos WHERE retiro_id = ?`,
  )
    .bind(retiro.id)
    .all<{
      id: number;
      nome: string;
      dia: string;
      inicio: string;
      musica: string | null;
    }>();

  // ids por momento em ordem cronológica -> contagens e amostras estáveis
  const ids = await idsPorMomento(env.DB, retiro);
  const porMomento = new Map<number, number[]>();
  for (const f of ids) {
    if (f.momento_id === null) continue; // linha do tempo é só a narrativa dos momentos
    const lista = porMomento.get(f.momento_id) ?? [];
    lista.push(f.id);
    porMomento.set(f.momento_id, lista);
  }
  const contagens: Record<number, number> = {};
  for (const [momentoId, lista] of porMomento) contagens[momentoId] = lista.length;
  const blocos = blocosLinhaDoTempo(momentos, contagens);

  // uma amostra estável por momento; um único IN busca todas de uma vez
  const idsAmostras = blocos.flatMap((bloco) =>
    amostraEstavel(
      porMomento.get(bloco.momentoId) ?? [],
      AMOSTRA,
      `${retiro.slug}:${bloco.momentoId}`,
    ),
  );
  const itens = await itensPorIds(
    env.DB,
    retiro,
    idsAmostras,
    env.MIDIA_URL_PUBLICA,
  );
  const itemPorId = new Map(itens.map((i) => [i.id, i]));
  const blocosComAmostra = blocos.map((bloco) => ({
    ...bloco,
    amostra: (porMomento.get(bloco.momentoId) ?? [])
      .filter((id) => itemPorId.has(id))
      .map((id) => itemPorId.get(id)!),
  }));

  return { retiro, blocos: blocosComAmostra };
}

export default function LinhaDoTempo({ loaderData }: Route.ComponentProps) {
  const { retiro, blocos } = loaderData;
  const base = `/retiros/${retiro.slug}`;
  return (
    <main className="mx-auto max-w-5xl p-4">
      <p>
        <Link to={base} className="underline">
          ← {retiro.titulo}
        </Link>
      </p>
      <h1 className="text-2xl font-bold">Linha do tempo</h1>
      {blocos.length === 0 && <p>Nenhuma foto nos momentos ainda.</p>}
      {blocos.map((bloco) => (
        <section
          key={bloco.momentoId}
          aria-label={bloco.nome}
          className="mt-6"
        >
          <h2 className="text-xl font-bold">{bloco.nome}</h2>
          <p className="text-sm">
            {dataPorExtensoPtBr(bloco.dia)}
            {bloco.musica && <> · Música: {bloco.musica}</>}
          </p>
          <GradeFotos
            itens={bloco.amostra as ItemGaleria[]}
            urlItem={(item) =>
              `${base}/fotos?momento=${bloco.momentoId}&foto=${item.id}`
            }
          />
          <p className="mt-1">
            <Link
              to={`${base}/fotos?momento=${bloco.momentoId}`}
              className="underline"
            >
              Ver todas ({bloco.total})
            </Link>
          </p>
        </section>
      ))}
    </main>
  );
}
