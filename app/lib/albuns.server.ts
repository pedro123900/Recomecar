// Consultas públicas CURADAS (Bloco C): álbuns são sobreposição fora do
// tempo, e por isso este módulo é deliberadamente separado de
// retiro-publico.server.ts — lá, toda consulta temporal embute o fragmento
// SEM_ALBUM_EXCLUSIVO (com prova por teste); aqui, NENHUMA consulta o embute,
// porque o álbum é justamente o único lugar onde a foto de álbum exclusivo
// aparece (prova espelhada em albuns.server.test.ts). A curadoria do admin
// não usa nem um módulo nem o outro: enxerga o acervo inteiro.

import { ehInstagramaveis } from "./albuns";
import {
  itemGaleria,
  type ItemGaleria,
  type LinhaFotoGaleria,
} from "./galeria";
import { COLUNAS_GRADE } from "./retiro-publico.server";
import type { Retiro } from "./tipos";

// Álbum vazio some do público (mesma regra do evento de Preparação): o JOIN
// estrito com album_fotos só devolve álbum com pelo menos um vínculo.
export const SQL_ALBUNS_COM_FOTOS = `SELECT a.id, a.nome, a.grupo, a.cor, a.exclusivo,
    COUNT(af.foto_id) AS total
   FROM albuns a JOIN album_fotos af ON af.album_id = a.id
  WHERE a.retiro_id = ?
  GROUP BY a.id
  ORDER BY a.ordem, a.id`;

export interface AlbumPublico {
  id: number;
  nome: string;
  grupo: string | null;
  cor: string | null;
  exclusivo: number;
  total: number;
}

export async function albunsComFotos(
  db: D1Database,
  retiro: Retiro,
): Promise<AlbumPublico[]> {
  const { results } = await db
    .prepare(SQL_ALBUNS_COM_FOTOS)
    .bind(retiro.id)
    .all<AlbumPublico>();
  return results;
}

// A ordem é a manual da curadoria (af.ordem), nunca a cronológica: álbum é
// narrativa montada pela Holly. O filtro por retiro_id barra id de álbum de
// outra edição colado na URL.
export const SQL_FOTOS_DO_ALBUM = `SELECT ${COLUNAS_GRADE}
   FROM album_fotos af
   JOIN fotos f ON f.id = af.foto_id
   LEFT JOIN momentos m ON m.id = f.momento_id
   LEFT JOIN eventos e ON e.id = f.evento_id
  WHERE af.album_id = ? AND f.retiro_id = ?
  ORDER BY af.ordem, af.foto_id`;

export async function itensDoAlbum(
  db: D1Database,
  retiro: Retiro,
  albumId: number,
  basePublica: string | undefined,
  limite: number,
  offset = 0,
): Promise<ItemGaleria[]> {
  const { results } = await db
    .prepare(`${SQL_FOTOS_DO_ALBUM} LIMIT ? OFFSET ?`)
    .bind(albumId, retiro.id, limite, offset)
    .all<LinhaFotoGaleria>();
  return results.map((l) => itemGaleria(l, retiro.titulo, basePublica));
}

export const SQL_CONTAR_FOTOS_DO_ALBUM = `SELECT COUNT(*) AS total
   FROM album_fotos af JOIN fotos f ON f.id = af.foto_id
  WHERE af.album_id = ? AND f.retiro_id = ?`;

export async function contarFotosDoAlbum(
  db: D1Database,
  retiro: Retiro,
  albumId: number,
): Promise<number> {
  const linha = await db
    .prepare(SQL_CONTAR_FOTOS_DO_ALBUM)
    .bind(albumId, retiro.id)
    .first<{ total: number }>();
  return linha?.total ?? 0;
}

// Lightbox aberto por URL compartilhada: a foto pedida pode estar fora da
// página atual do álbum — busca isolada, ainda no contexto do álbum.
export const SQL_FOTO_DO_ALBUM = `SELECT ${COLUNAS_GRADE}
   FROM album_fotos af
   JOIN fotos f ON f.id = af.foto_id
   LEFT JOIN momentos m ON m.id = f.momento_id
   LEFT JOIN eventos e ON e.id = f.evento_id
  WHERE af.album_id = ? AND f.retiro_id = ? AND f.id = ?`;

export async function itemDoAlbumPorId(
  db: D1Database,
  retiro: Retiro,
  albumId: number,
  fotoId: number,
  basePublica: string | undefined,
): Promise<ItemGaleria | null> {
  const linha = await db
    .prepare(SQL_FOTO_DO_ALBUM)
    .bind(albumId, retiro.id, fotoId)
    .first<LinhaFotoGaleria>();
  return linha ? itemGaleria(linha, retiro.titulo, basePublica) : null;
}

// ---------------------------------------------------------------------------
// Admin (curadoria): carregamento compartilhado pela tela de curadoria e pela
// resource route de ações — retiro por slug SEM exigir publicado, álbum
// amarrado ao retiro (id de outra edição na URL → 404).

export interface AlbumAdmin {
  id: number;
  nome: string;
  grupo: string | null;
  cor: string | null;
  ordem: number;
  exclusivo: number;
}

export async function carregarAlbumAdmin(
  db: D1Database,
  slug: string,
  albumBruto: string,
): Promise<{ retiro: Retiro; album: AlbumAdmin }> {
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(slug)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });
  const album = await db
    .prepare("SELECT * FROM albuns WHERE id = ? AND retiro_id = ?")
    .bind(Number(albumBruto), retiro.id)
    .first<AlbumAdmin>();
  if (!album) throw new Response("Álbum não encontrado", { status: 404 });
  return { retiro, album };
}

// Destaques da capa: as primeiras fotos do álbum "Instagramáveis" pela ordem
// manual. O álbum é achado pelo nome normalizado em JS (o NOCASE do SQL não
// dobra acento); sem álbum ou vazio, devolve [] e a capa cai no fallback
// (amostra estável — essa sim temporal, com o fragmento de exclusão).
export async function destaquesInstagramaveis(
  db: D1Database,
  retiro: Retiro,
  basePublica: string | undefined,
  limite: number,
): Promise<ItemGaleria[]> {
  const { results: albuns } = await db
    .prepare("SELECT id, nome FROM albuns WHERE retiro_id = ?")
    .bind(retiro.id)
    .all<{ id: number; nome: string }>();
  const album = albuns.find((a) => ehInstagramaveis(a.nome));
  if (!album) return [];
  return itensDoAlbum(db, retiro, album.id, basePublica, limite);
}
