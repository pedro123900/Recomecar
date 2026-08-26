import { data } from "react-router";
import type { Route } from "./+types/albuns-acao";
import { carregarAlbumAdmin } from "~/lib/albuns.server";
import { contextoCloudflare } from "~/lib/contexto";

// Resource route das ações de curadoria (vincular/desvincular/reordenar),
// chamada via useFetcher pela tela de curadoria — POST de documento em rota
// com componente devolve HTML re-renderizado no RR8 (beco registrado).
// Nada aqui mexe em momento_id/evento_id: álbum é sobreposição, o re-tag não
// tem papel; a exclusividade é computada nas consultas públicas.

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const { retiro, album } = await carregarAlbumAdmin(
    db,
    params.edicao,
    params.album,
  );

  const form = await request.formData();
  const intent = form.get("intent");
  const ids = form
    .getAll("foto")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  try {
    if (intent === "vincular") {
      if (ids.length === 0) {
        return data({ erro: "Marque ao menos uma foto." }, { status: 400 });
      }
      // entram no fim da ordem manual; INSERT ... SELECT amarra a foto ao
      // retiro do álbum (id estranho na URL não vincula nada) e OR IGNORE
      // torna o lote idempotente (re-submissão não duplica nem embaralha)
      const maxLinha = await db
        .prepare(
          "SELECT COALESCE(MAX(ordem), -1) AS m FROM album_fotos WHERE album_id = ?",
        )
        .bind(album.id)
        .first<{ m: number }>();
      let ordem = (maxLinha?.m ?? -1) + 1;
      await db.batch(
        ids.map((fotoId) =>
          db
            .prepare(
              `INSERT OR IGNORE INTO album_fotos (album_id, foto_id, ordem)
               SELECT ?, id, ? FROM fotos WHERE id = ? AND retiro_id = ?`,
            )
            .bind(album.id, ordem++, fotoId, retiro.id),
        ),
      );
      return { ok: true };
    }

    if (intent === "desvincular") {
      if (ids.length === 0) {
        return data({ erro: "Nenhuma foto indicada." }, { status: 400 });
      }
      const marcadores = ids.map(() => "?").join(", ");
      await db
        .prepare(
          `DELETE FROM album_fotos WHERE album_id = ? AND foto_id IN (${marcadores})`,
        )
        .bind(album.id, ...ids)
        .run();
      return { ok: true };
    }

    if (intent === "mover") {
      const fotoId = ids[0];
      const direcao = form.get("direcao");
      const { results: lista } = await db
        .prepare(
          "SELECT foto_id FROM album_fotos WHERE album_id = ? ORDER BY ordem, foto_id",
        )
        .bind(album.id)
        .all<{ foto_id: number }>();
      const posicoes = lista.map((l) => l.foto_id);
      const indice = posicoes.indexOf(fotoId);
      const alvo = direcao === "subir" ? indice - 1 : indice + 1;
      if (indice < 0 || alvo < 0 || alvo >= posicoes.length) {
        return { ok: true }; // já na ponta (ou foto fora do álbum): nada a fazer
      }
      [posicoes[indice], posicoes[alvo]] = [posicoes[alvo], posicoes[indice]];
      // regrava ordem = posição para a lista inteira: além do swap, normaliza
      // ordens duplicadas herdadas do DEFAULT 0 (auto-cura da ordenação)
      await db.batch(
        posicoes.map((id, i) =>
          db
            .prepare(
              "UPDATE album_fotos SET ordem = ? WHERE album_id = ? AND foto_id = ?",
            )
            .bind(i, album.id, id),
        ),
      );
      return { ok: true };
    }

    return data({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return data({ erro: `Erro do banco: ${String(e)}` }, { status: 400 });
  }
}
