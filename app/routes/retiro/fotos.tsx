import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/fotos";
import { ChipsFiltros, type GrupoDeChips } from "~/componentes/chips-filtros";
import { GradeFotos } from "~/componentes/grade-fotos";
import { Lightbox } from "~/componentes/lightbox";
import {
  albunsComFotos,
  contarFotosDoAlbum,
  itemDoAlbumPorId,
  itensDoAlbum,
} from "~/lib/albuns.server";
import { contextoCloudflare } from "~/lib/contexto";
import {
  FOTOS_POR_PAGINA,
  analisarFiltros,
  condicoesGrade,
  diasDoRetiro,
  itemGaleria,
  paginar,
  type ItemGaleria,
  type LinhaFotoGaleria,
} from "~/lib/galeria";
import {
  COLUNAS_GRADE,
  DE_FOTOS,
  ORDEM_CRONOLOGICA,
  carregarRetiroPublicado,
  eventosComFotos as consultarEventosComFotos,
  faixasDoRetiro,
  momentosComFotos as consultarMomentosComFotos,
  musicasComFotos,
  temGeral as consultarTemGeral,
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
      album: url.searchParams.get("album") ?? undefined,
    },
    dias,
  );

  const paginaBruta = url.searchParams.get("pagina") ?? undefined;
  let total: number;
  let pag: ReturnType<typeof paginar>;
  let itens: ItemGaleria[];
  if (filtros.album) {
    // álbum é sobreposição curada: consulta própria (albuns.server), ordem
    // manual da curadoria e SEM o fragmento de exclusão — a grade do álbum é
    // exatamente onde foto de álbum exclusivo aparece
    total = await contarFotosDoAlbum(env.DB, retiro, filtros.album);
    pag = paginar(total, paginaBruta);
    itens = await itensDoAlbum(
      env.DB,
      retiro,
      filtros.album,
      env.MIDIA_URL_PUBLICA,
      FOTOS_POR_PAGINA,
      pag.offset,
    );
  } else {
    const cond = condicoesGrade(filtros, faixas, dias);
    const onde = cond.sql ? ` AND ${cond.sql}` : "";
    const contagem = await env.DB.prepare(
      `SELECT COUNT(*) AS total ${DE_FOTOS}${onde}`,
    )
      .bind(retiro.id, ...cond.binds)
      .first<{ total: number }>();
    total = contagem?.total ?? 0;
    pag = paginar(total, paginaBruta);
    const { results } = await env.DB.prepare(
      `SELECT ${COLUNAS_GRADE} ${DE_FOTOS}${onde} ${ORDEM_CRONOLOGICA} LIMIT ? OFFSET ?`,
    )
      .bind(retiro.id, ...cond.binds, FOTOS_POR_PAGINA, pag.offset)
      .all<LinhaFotoGaleria>();
    itens = results.map((l) =>
      itemGaleria(l, retiro.titulo, env.MIDIA_URL_PUBLICA),
    );
  }

  // dados dos chips: só o que existe no acervo público (helpers centralizados
  // em retiro-publico.server — exclusão de álbum exclusivo embutida; os
  // álbuns vêm do módulo curado, sem o fragmento, de propósito)
  const momentosComFotos = await consultarMomentosComFotos(env.DB, retiro);
  const eventosComFotos = await consultarEventosComFotos(env.DB, retiro);
  const musicas = await musicasComFotos(env.DB, retiro);
  const temGeral = await consultarTemGeral(env.DB, retiro);
  const albunsPublicos = await albunsComFotos(env.DB, retiro);

  // lightbox: foto pedida fora da página atual (URL manual) abre isolada —
  // no contexto do álbum quando o filtro é de álbum
  const fotoBruta = url.searchParams.get("foto");
  let fotoIsolada = null;
  if (fotoBruta && /^\d+$/.test(fotoBruta) && !itens.some((i) => i.id === Number(fotoBruta))) {
    if (filtros.album) {
      fotoIsolada = await itemDoAlbumPorId(
        env.DB,
        retiro,
        filtros.album,
        Number(fotoBruta),
        env.MIDIA_URL_PUBLICA,
      );
    } else {
      const linha = await env.DB.prepare(
        `SELECT ${COLUNAS_GRADE} ${DE_FOTOS} AND f.id = ?`,
      )
        .bind(retiro.id, Number(fotoBruta))
        .first<LinhaFotoGaleria>();
      if (linha) fotoIsolada = itemGaleria(linha, retiro.titulo, env.MIDIA_URL_PUBLICA);
    }
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
    temGeral,
    musicas,
    albunsPublicos,
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
    albunsPublicos,
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
  // trocar filtro volta à página 1 e fecha o lightbox; evento (Preparação) e
  // album (curadoria) são excludentes com tudo, inclusive entre si — ligar um
  // desliga todos os outros
  const urlFiltro = (chave: string, valor: string | null) =>
    url(
      chave === "evento" || chave === "album"
        ? { evento: null, album: null, [chave]: valor, dia: null, momento: null, musica: null, pagina: null, foto: null }
        : { [chave]: valor, evento: null, album: null, pagina: null, foto: null },
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
    {
      titulo: "Álbuns",
      chips: albunsPublicos.map((a) =>
        chip(a.nome, "album", String(a.id), filtros.album === a.id),
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
