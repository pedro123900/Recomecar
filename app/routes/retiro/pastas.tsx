import { Link } from "react-router";
import type { Route } from "./+types/pastas";
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
    { title: `Pastas — ${loaderData?.retiro.titulo ?? "Retiro"} — Grupo Recomeçar` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const { env } = context.get(contextoCloudflare);
  const retiro = await carregarRetiroPublicado(env.DB, params.edicao);
  const dias = diasDoRetiro(retiro);
  const faixas = await faixasDoRetiro(env.DB, retiro);

  // contagem por dia com a herança de faixa (mesma condição da grade)
  const pastas = [];
  for (const dia of dias) {
    const cond = condicoesGrade({ dia: dia.ordinal }, faixas, dias);
    const linha = await env.DB.prepare(
      `SELECT COUNT(*) AS total ${DE_FOTOS} AND ${cond.sql}`,
    )
      .bind(retiro.id, ...cond.binds)
      .first<{ total: number }>();
    pastas.push({ ...dia, total: linha?.total ?? 0 });
  }
  return { retiro, pastas };
}

export default function Pastas({ loaderData }: Route.ComponentProps) {
  const { retiro, pastas } = loaderData;
  const base = `/retiros/${retiro.slug}`;
  return (
    <main className="mx-auto max-w-5xl p-4">
      <p>
        <Link to={base} className="underline">
          ← {retiro.titulo}
        </Link>
      </p>
      <h1 className="text-2xl font-bold">Pastas</h1>
      <ul className="mt-3 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {pastas.map((pasta) => (
          <li key={pasta.ordinal}>
            <Link
              to={`${base}/pastas/${pasta.ordinal}`}
              className="block border p-4 underline"
            >
              <span className="text-lg font-bold">{pasta.rotulo}</span>
              <br />
              {dataPorExtensoPtBr(pasta.data)} · {pasta.total}{" "}
              {pasta.total === 1 ? "foto" : "fotos"}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
