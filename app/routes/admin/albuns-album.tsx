import { Form, Link, useFetcher, useSearchParams } from "react-router";
import type { Route } from "./+types/albuns-album";
import { Coracao } from "~/componentes/coracao";
import { carregarAlbumAdmin, itensDoAlbum } from "~/lib/albuns.server";
import { contextoCloudflare } from "~/lib/contexto";
import {
  FOTOS_POR_PAGINA,
  diasDoRetiro,
  itemGaleria,
  paginar,
  type LinhaFotoGaleria,
} from "~/lib/galeria";
import { COLUNAS_GRADE, ORDEM_CRONOLOGICA } from "~/lib/retiro-publico.server";

// Curadoria (Bloco C): a única tela que enxerga o acervo INTEIRO do retiro —
// inclusive fotos já em álbuns exclusivos (por isso a consulta é local, sem
// retiro-publico.server.ts e sem o fragmento de exclusão). Fotos entram em
// álbum somente aqui, nunca no upload.

export function meta() {
  return [{ title: "Curadoria de álbum — Grupo Recomeçar" }];
}

// teto prático para a lista de reordenação; álbum real tem dezenas de fotos
const TODAS_DO_ALBUM = 10000;

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { env } = context.get(contextoCloudflare);
  const { retiro, album } = await carregarAlbumAdmin(
    env.DB,
    params.edicao,
    params.album,
  );

  // fotos já no álbum, na ordem manual (mesma consulta curada do público)
  const noAlbum = await itensDoAlbum(
    env.DB,
    retiro,
    album.id,
    env.MIDIA_URL_PUBLICA,
    TODAS_DO_ALBUM,
  );

  // acervo inteiro, com filtros simples de dia/momento para achar as fotos
  // (sem herança de faixa — isto é ferramenta de admin, não a grade pública)
  const url = new URL(request.url);
  const dias = diasDoRetiro(retiro);
  const partes: string[] = [];
  const binds: (string | number)[] = [];
  const diaBruto = url.searchParams.get("dia");
  const dia = dias.find((d) => d.ordinal === diaBruto);
  if (dia) {
    partes.push("m.dia = ?");
    binds.push(dia.data);
  }
  const momentoBruto = url.searchParams.get("momento");
  if (momentoBruto === "geral") {
    partes.push("f.momento_id IS NULL AND f.evento_id IS NULL");
  } else if (momentoBruto && /^[1-9]\d*$/.test(momentoBruto)) {
    partes.push("f.momento_id = ?");
    binds.push(Number(momentoBruto));
  }
  const onde = partes.length > 0 ? ` AND ${partes.join(" AND ")}` : "";

  const deAcervo = `FROM fotos f
    LEFT JOIN momentos m ON m.id = f.momento_id
    LEFT JOIN eventos e ON e.id = f.evento_id
   WHERE f.retiro_id = ?${onde}`;
  const contagem = await env.DB.prepare(
    `SELECT COUNT(*) AS total ${deAcervo}`,
  )
    .bind(retiro.id, ...binds)
    .first<{ total: number }>();
  const total = contagem?.total ?? 0;
  const pag = paginar(total, url.searchParams.get("pagina") ?? undefined);
  const { results } = await env.DB.prepare(
    `SELECT ${COLUNAS_GRADE} ${deAcervo} ${ORDEM_CRONOLOGICA} LIMIT ? OFFSET ?`,
  )
    .bind(retiro.id, ...binds, FOTOS_POR_PAGINA, pag.offset)
    .all<LinhaFotoGaleria>();
  const acervo = results.map((l) =>
    itemGaleria(l, retiro.titulo, env.MIDIA_URL_PUBLICA),
  );

  const { results: momentos } = await env.DB.prepare(
    "SELECT id, nome, dia FROM momentos WHERE retiro_id = ? ORDER BY inicio",
  )
    .bind(retiro.id)
    .all<{ id: number; nome: string; dia: string }>();

  return {
    retiro,
    album,
    noAlbum,
    acervo,
    total,
    pag,
    dias,
    momentos,
    filtros: { dia: dia?.ordinal ?? "", momento: momentoBruto ?? "" },
  };
}

export default function CuradoriaAlbum({ loaderData }: Route.ComponentProps) {
  const { retiro, album, noAlbum, acervo, total, pag, dias, momentos, filtros } =
    loaderData;
  const fetcher = useFetcher();
  const [params] = useSearchParams();
  const acao = `/admin/retiros/${retiro.slug}/albuns/${album.id}/acao`;
  const vinculadas = new Set(noAlbum.map((i) => i.id));

  const urlPagina = (pagina: number) => {
    const q = new URLSearchParams(params);
    q.set("pagina", String(pagina));
    return `?${q.toString()}`;
  };

  return (
    <main>
      <h1>
        <Coracao cor={album.cor} /> {album.nome} — {retiro.titulo}
      </h1>
      <p>
        <Link to={`/admin/retiros/${retiro.slug}/albuns`}>← Álbuns</Link>
      </p>
      {album.exclusivo === 1 && (
        <p>
          <small>
            Álbum exclusivo: foto vinculada aqui sai das grades do tempo no
            site e passa a existir só neste álbum. Desvincular a devolve.
          </small>
        </p>
      )}
      {fetcher.data?.erro && <p role="alert">{fetcher.data.erro}</p>}

      <section aria-label="Fotos no álbum">
        <h2>
          No álbum ({noAlbum.length}
          {noAlbum.length === 1 ? " foto" : " fotos"})
        </h2>
        {noAlbum.length === 0 ? (
          <p>Nenhuma foto ainda — marque fotos do acervo abaixo.</p>
        ) : (
          <ol style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", padding: 0 }}>
            {noAlbum.map((item, i) => (
              <li key={item.id} style={{ width: "9rem" }}>
                <img
                  src={item.urlExibicao}
                  alt={item.alt}
                  width={item.largura}
                  height={item.altura}
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "auto" }}
                />
                <small>
                  {i + 1}ª · {item.legenda}
                </small>
                <br />
                <fetcher.Form method="post" action={acao} style={{ display: "inline" }}>
                  <input type="hidden" name="intent" value="mover" />
                  <input type="hidden" name="foto" value={item.id} />
                  <button name="direcao" value="subir" disabled={i === 0}>
                    ↑
                  </button>{" "}
                  <button
                    name="direcao"
                    value="descer"
                    disabled={i === noAlbum.length - 1}
                  >
                    ↓
                  </button>
                </fetcher.Form>{" "}
                <fetcher.Form method="post" action={acao} style={{ display: "inline" }}>
                  <input type="hidden" name="intent" value="desvincular" />
                  <input type="hidden" name="foto" value={item.id} />
                  <button type="submit">Remover</button>
                </fetcher.Form>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Acervo do retiro">
        <h2>Acervo inteiro ({total})</h2>
        <Form method="get">
          <label>
            Dia{" "}
            <select name="dia" defaultValue={filtros.dia}>
              <option value="">todos</option>
              {dias.map((d) => (
                <option key={d.ordinal} value={d.ordinal}>
                  {d.rotulo}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Momento{" "}
            <select name="momento" defaultValue={filtros.momento}>
              <option value="">todos</option>
              {momentos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.dia})
                </option>
              ))}
              <option value="geral">Geral</option>
            </select>
          </label>{" "}
          <button type="submit">Filtrar</button>
        </Form>

        <fetcher.Form method="post" action={acao}>
          <input type="hidden" name="intent" value="vincular" />
          <p>
            <button type="submit">Adicionar selecionadas ao álbum</button>
          </p>
          <ul style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", padding: 0 }}>
            {acervo.map((item) => (
              <li key={item.id} style={{ width: "9rem" }}>
                <label>
                  {vinculadas.has(item.id) ? (
                    <small>já no álbum</small>
                  ) : (
                    <input type="checkbox" name="foto" value={item.id} />
                  )}
                  <img
                    src={item.urlExibicao}
                    alt={item.alt}
                    width={item.largura}
                    height={item.altura}
                    loading="lazy"
                    decoding="async"
                    style={{ width: "100%", height: "auto" }}
                  />
                  <small>{item.legenda}</small>
                </label>
              </li>
            ))}
          </ul>
        </fetcher.Form>

        {pag.paginas > 1 && (
          <nav aria-label="Páginas">
            {pag.pagina > 1 && (
              <Link to={urlPagina(pag.pagina - 1)}>← Página anterior</Link>
            )}{" "}
            página {pag.pagina} de {pag.paginas}{" "}
            {pag.pagina < pag.paginas && (
              <Link to={urlPagina(pag.pagina + 1)}>Próxima página →</Link>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
