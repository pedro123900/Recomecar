import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/fotos";
import { ChipsFiltros, type GrupoDeChips } from "~/componentes/chips-filtros";
import { GradeFotos } from "~/componentes/grade-fotos";
import { Lightbox } from "~/componentes/lightbox";
import { contextoCloudflare } from "~/lib/contexto";
import {
  FOTOS_POR_PAGINA,
  analisarFiltros,
  condicoesGrade,
  diasDoRetiro,
  itemGaleria,
  paginar,
  type LinhaFotoGaleria,
} from "~/lib/galeria";
import {
  COLUNAS_GRADE,
  DE_FOTOS,
  ORDEM_CRONOLOGICA,
  carregarRetiroPublicado,
  faixasDoRetiro,
} from "~/lib/retiro-publico.server";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `Fotos — ${loaderData?.retiro.titulo ?? "Retiro"} — Grupo Recomeçar` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { env } = context.get(contextoCloudflare);
  const retiro = await carregarRetiroPublicado(env.DB, params.edicao);
  const dias = diasDoRetiro(retiro);
  const faixas = await faixasDoRetiro(env.DB, retiro);

  const url = new URL(request.url);
  const filtros = analisarFiltros(
    {
      dia: url.searchParams.get("dia") ?? undefined,
      momento: url.searchParams.get("momento") ?? undefined,
      musica: url.searchParams.get("musica") ?? undefined,
      evento: url.searchParams.get("evento") ?? undefined,
    },
    dias,
  );
  const cond = condicoesGrade(filtros, faixas, dias);
  const onde = cond.sql ? ` AND ${cond.sql}` : "";

  const contagem = await env.DB.prepare(
    `SELECT COUNT(*) AS total ${DE_FOTOS}${onde}`,
  )
    .bind(retiro.id, ...cond.binds)
    .first<{ total: number }>();
  const total = contagem?.total ?? 0;
  const pag = paginar(total, url.searchParams.get("pagina") ?? undefined);

  const { results } = await env.DB.prepare(
    `SELECT ${COLUNAS_GRADE} ${DE_FOTOS}${onde} ${ORDEM_CRONOLOGICA} LIMIT ? OFFSET ?`,
  )
    .bind(retiro.id, ...cond.binds, FOTOS_POR_PAGINA, pag.offset)
    .all<LinhaFotoGaleria>();
  const itens = results.map((l) =>
    itemGaleria(l, retiro.titulo, env.MIDIA_URL_PUBLICA),
  );

  // dados dos chips: só o que existe no acervo
  const { results: momentosComFotos } = await env.DB.prepare(
    `SELECT m.id, m.nome FROM momentos m JOIN fotos f ON f.momento_id = m.id
      WHERE m.retiro_id = ? GROUP BY m.id ORDER BY m.inicio`,
  )
    .bind(retiro.id)
    .all<{ id: number; nome: string }>();
  // Geral = fora dos DOIS sistemas temporais (foto de evento não conta)
  const semMomento = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM fotos
      WHERE retiro_id = ? AND momento_id IS NULL AND evento_id IS NULL`,
  )
    .bind(retiro.id)
    .first<{ total: number }>();
  const { results: eventosComFotos } = await env.DB.prepare(
    `SELECT e.id, e.nome FROM eventos e JOIN fotos f ON f.evento_id = e.id
      WHERE e.retiro_id = ? GROUP BY e.id ORDER BY e.data, e.horario, e.id`,
  )
    .bind(retiro.id)
    .all<{ id: number; nome: string }>();
  const { results: musicas } = await env.DB.prepare(
    `SELECT DISTINCT m.musica FROM momentos m JOIN fotos f ON f.momento_id = m.id
      WHERE m.retiro_id = ? AND m.musica IS NOT NULL ORDER BY m.musica`,
  )
    .bind(retiro.id)
    .all<{ musica: string }>();

  // lightbox: foto pedida fora da página atual (URL manual) abre isolada
  const fotoBruta = url.searchParams.get("foto");
  let fotoIsolada = null;
  if (fotoBruta && /^\d+$/.test(fotoBruta) && !itens.some((i) => i.id === Number(fotoBruta))) {
    const linha = await env.DB.prepare(
      `SELECT ${COLUNAS_GRADE} ${DE_FOTOS} AND f.id = ?`,
    )
      .bind(retiro.id, Number(fotoBruta))
      .first<LinhaFotoGaleria>();
    if (linha) fotoIsolada = itemGaleria(linha, retiro.titulo, env.MIDIA_URL_PUBLICA);
  }

  return {
    retiro,
    dias,
    filtros,
    total,
    pag,
    itens,
    fotoIsolada,
    momentosComFotos,
    eventosComFotos,
    temGeral: (semMomento?.total ?? 0) > 0,
    musicas: musicas.map((m) => m.musica),
  };
}

export default function Fotos({ loaderData }: Route.ComponentProps) {
  const {
    retiro,
    dias,
    filtros,
    total,
    pag,
    itens,
    fotoIsolada,
    momentosComFotos,
    eventosComFotos,
    temGeral,
    musicas,
  } = loaderData;
  const [params] = useSearchParams();
  const caminho = `/retiros/${retiro.slug}/fotos`;

  const url = (mudancas: Record<string, string | null>) => {
    const q = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) q.delete(chave);
      else q.set(chave, valor);
    }
    const s = q.toString();
    return s ? `${caminho}?${s}` : caminho;
  };
  // trocar filtro volta à página 1 e fecha o lightbox; evento (Preparação) é
  // excludente com os filtros do tempo do retiro — ligar um desliga o outro
  const urlFiltro = (chave: string, valor: string | null) =>
    url(
      chave === "evento"
        ? { evento: valor, dia: null, momento: null, musica: null, pagina: null, foto: null }
        : { [chave]: valor, evento: null, pagina: null, foto: null },
    );

  const chip = (rotulo: string, chave: string, valor: string, ativo: boolean) => ({
    rotulo,
    ativo,
    url: urlFiltro(chave, ativo ? null : valor),
  });
  const grupos: GrupoDeChips[] = [
    {
      titulo: "Dia",
      chips: dias.map((d) => chip(d.rotulo, "dia", d.ordinal, filtros.dia === d.ordinal)),
    },
    {
      titulo: "Momento",
      chips: [
        ...momentosComFotos.map((m) =>
          chip(m.nome, "momento", String(m.id), filtros.momento === m.id),
        ),
        ...(temGeral ? [chip("Geral", "momento", "geral", filtros.momento === "geral")] : []),
      ],
    },
    {
      titulo: "Música",
      chips: musicas.map((m) => chip(m, "musica", m, filtros.musica === m)),
    },
    {
      titulo: "Preparação",
      chips: eventosComFotos.map((e) =>
        chip(e.nome, "evento", String(e.id), filtros.evento === e.id),
      ),
    },
  ];

  const fotoBruta = params.get("foto");
  const indice = fotoBruta ? itens.findIndex((i) => i.id === Number(fotoBruta)) : -1;
  const aberta = indice >= 0 ? itens[indice] : fotoIsolada;
  const anterior = indice > 0 ? itens[indice - 1] : null;
  const proxima = indice >= 0 && indice < itens.length - 1 ? itens[indice + 1] : null;

  return (
    <main className="mx-auto max-w-5xl p-4">
      <p>
        <Link to={`/retiros/${retiro.slug}`} className="underline">
          ← {retiro.titulo}
        </Link>
      </p>
      <h1 className="text-2xl font-bold">Fotos</h1>
      <ChipsFiltros grupos={grupos} />
      <p className="mt-3 text-sm">
        {total} {total === 1 ? "item" : "itens"}
        {pag.paginas > 1 && (
          <>
            {" "}
            · página {pag.pagina} de {pag.paginas}
          </>
        )}
      </p>
      {itens.length === 0 ? (
        <p className="mt-3">Nenhuma foto para este filtro.</p>
      ) : (
        <GradeFotos itens={itens} urlItem={(item) => url({ foto: String(item.id) })} />
      )}
      {pag.paginas > 1 && (
        <nav aria-label="Páginas" className="mt-4 flex justify-between">
          {pag.pagina > 1 ? (
            <Link
              to={url({ pagina: String(pag.pagina - 1), foto: null })}
              className="underline"
            >
              ← Página anterior
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          {pag.pagina < pag.paginas ? (
            <Link
              to={url({ pagina: String(pag.pagina + 1), foto: null })}
              className="underline"
            >
              Próxima página →
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      )}
      {aberta && (
        <Lightbox
          item={aberta}
          urlFechar={url({ foto: null })}
          urlAnterior={anterior ? url({ foto: String(anterior.id) }) : null}
          urlProxima={proxima ? url({ foto: String(proxima.id) }) : null}
        />
      )}
    </main>
  );
}
