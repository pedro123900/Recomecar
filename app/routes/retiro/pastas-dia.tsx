import { Link } from "react-router";
import type { Route } from "./+types/pastas-dia";
import { contextoCloudflare } from "~/lib/contexto";
import {
  condicoesGrade,
  dataPorExtensoPtBr,
  diasDoRetiro,
} from "~/lib/galeria";
import {
  DE_FOTOS,
  carregarRetiroPublicado,
  faixasDoRetiro,
} from "~/lib/retiro-publico.server";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData?.dia.rotulo ?? "Dia"} — ${loaderData?.retiro.titulo ?? "Retiro"} — Grupo Recomeçar`,
    },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const { env } = context.get(contextoCloudflare);
  const retiro = await carregarRetiroPublicado(env.DB, params.edicao);
  const dias = diasDoRetiro(retiro);
  const dia = dias.find((d) => d.ordinal === params.dia);
  if (!dia) throw new Response("Dia não encontrado", { status: 404 });

  // pastas de momento: só as que têm fotos (o público mostra o que tem)
  const { results: momentos } = await env.DB.prepare(
    `SELECT m.id, m.nome, m.inicio, COUNT(f.id) AS total
       FROM momentos m JOIN fotos f ON f.momento_id = m.id
      WHERE m.retiro_id = ? AND m.dia = ?
      GROUP BY m.id ORDER BY m.inicio`,
  )
    .bind(retiro.id, dia.data)
    .all<{ id: number; nome: string; inicio: string; total: number }>();

  // total do dia inclui as fotos sem momento herdadas pela faixa
  const faixas = await faixasDoRetiro(env.DB, retiro);
  const cond = condicoesGrade({ dia: dia.ordinal }, faixas, dias);
  const linha = await env.DB.prepare(
    `SELECT COUNT(*) AS total ${DE_FOTOS} AND ${cond.sql}`,
  )
    .bind(retiro.id, ...cond.binds)
    .first<{ total: number }>();

  return { retiro, dia, momentos, totalDoDia: linha?.total ?? 0 };
}

export default function PastasDia({ loaderData }: Route.ComponentProps) {
  const { retiro, dia, momentos, totalDoDia } = loaderData;
  const base = `/retiros/${retiro.slug}`;
  return (
    <main className="mx-auto max-w-5xl p-4">
      <p>
        <Link to={`${base}/pastas`} className="underline">
          ← Pastas
        </Link>
      </p>
      <h1 className="text-2xl font-bold">{dia.rotulo}</h1>
      <p>{dataPorExtensoPtBr(dia.data)}</p>
      <ul className="mt-3 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {momentos.map((momento) => (
          <li key={momento.id}>
            <Link
              to={`${base}/fotos?momento=${momento.id}`}
              className="block border p-4 underline"
            >
              <span className="font-bold">{momento.nome}</span> ·{" "}
              {momento.total} {momento.total === 1 ? "foto" : "fotos"}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3">
        <Link to={`${base}/fotos?dia=${dia.ordinal}`} className="underline">
          Todas as fotos do dia ({totalDoDia})
        </Link>
      </p>
    </main>
  );
}
