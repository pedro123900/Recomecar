// Consultas compartilhadas pelas rotas públicas da edição (Bloco A).
// Toda lógica de regra vive nas funções puras (faixas.ts, galeria.ts);
// aqui é só SQL com binds e montagem de itens. Desde o Bloco C, TODA consulta
// temporal pública vive neste módulo, com o SQL exportado — o teste
// (retiro-publico.test.ts) prova que cada uma embute a exclusão de álbum
// exclusivo; consulta temporal nova em rota, fora daqui, escapa da prova.

import { faixasDosDias, type FaixaDia } from "./faixas";
import {
  diasDoRetiro,
  itemGaleria,
  type ItemGaleria,
  type LinhaFotoGaleria,
} from "./galeria";
import type { Retiro } from "./tipos";

// Exclusividade (Bloco C, decisão fechada): foto em álbum exclusivo sai de
// todas as grades temporais públicas e existe só no álbum. momento_id e
// evento_id permanecem gravados — dado é fato, exibição é escolha; nada é
// desnormalizado, a exclusão é computada aqui. A curadoria do admin NÃO usa
// este módulo (precisa ver o acervo inteiro).
export const SEM_ALBUM_EXCLUSIVO = `NOT EXISTS (SELECT 1 FROM album_fotos af
    JOIN albuns a ON a.id = af.album_id AND a.exclusivo = 1
    WHERE af.foto_id = f.id)`;

export async function carregarRetiroPublicado(
  db: D1Database,
  slug: string,
): Promise<Retiro> {
  // página pública: edição não publicada não existe para fora
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ? AND publicado = 1")
    .bind(slug)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });
  return retiro;
}

export async function faixasDoRetiro(
  db: D1Database,
  retiro: Retiro,
): Promise<FaixaDia[]> {
  const { results } = await db
    .prepare("SELECT dia, inicio FROM momentos WHERE retiro_id = ?")
    .bind(retiro.id)
    .all<{ dia: string; inicio: string }>();
  return faixasDosDias(
    diasDoRetiro(retiro).map((d) => d.data),
    results,
  );
}

export const COLUNAS_GRADE = `f.id, f.arquivo_r2, f.tipo, f.largura, f.altura, f.duracao,
  m.nome AS momento_nome, m.dia AS momento_dia,
  e.nome AS evento_nome, e.data AS evento_data`;

export const DE_FOTOS = `FROM fotos f LEFT JOIN momentos m ON m.id = f.momento_id
  LEFT JOIN eventos e ON e.id = f.evento_id
  WHERE f.retiro_id = ? AND ${SEM_ALBUM_EXCLUSIVO}`;

// vídeos desta fase não têm capturada_em: vão para o fim, ordem estável
export const ORDEM_CRONOLOGICA = `ORDER BY (f.capturada_em IS NULL), f.capturada_em, f.id`;

export async function itensPorIds(
  db: D1Database,
  retiro: Retiro,
  ids: number[],
  basePublica: string | undefined,
): Promise<ItemGaleria[]> {
  if (ids.length === 0) return [];
  const marcadores = ids.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT ${COLUNAS_GRADE} ${DE_FOTOS} AND f.id IN (${marcadores}) ${ORDEM_CRONOLOGICA}`,
    )
    .bind(retiro.id, ...ids)
    .all<LinhaFotoGaleria>();
  return results.map((l) => itemGaleria(l, retiro.titulo, basePublica));
}

// Eventos de Preparação COM fotos (o público mostra o que tem; evento vazio
// só aparece no admin), na ordem do dia: data, depois horário.
export const SQL_EVENTOS_COM_FOTOS = `SELECT e.id, e.nome, e.data, COUNT(f.id) AS total
   FROM eventos e JOIN fotos f ON f.evento_id = e.id AND ${SEM_ALBUM_EXCLUSIVO}
  WHERE e.retiro_id = ?
  GROUP BY e.id
  ORDER BY e.data, e.horario, e.id`;

export async function eventosComFotos(
  db: D1Database,
  retiro: Retiro,
): Promise<{ id: number; nome: string; data: string; total: number }[]> {
  const { results } = await db
    .prepare(SQL_EVENTOS_COM_FOTOS)
    .bind(retiro.id)
    .all<{ id: number; nome: string; data: string; total: number }>();
  return results;
}

// Ids das fotos de evento em ordem cronológica — base barata (só inteiros)
// para as amostras estáveis da seção Preparação da capa.
export const SQL_IDS_POR_EVENTO = `SELECT f.id, f.evento_id FROM fotos f
  WHERE f.retiro_id = ? AND f.evento_id IS NOT NULL AND ${SEM_ALBUM_EXCLUSIVO}
  ORDER BY (f.capturada_em IS NULL), f.capturada_em, f.id`;

export async function idsPorEvento(
  db: D1Database,
  retiro: Retiro,
): Promise<{ id: number; evento_id: number }[]> {
  const { results } = await db
    .prepare(SQL_IDS_POR_EVENTO)
    .bind(retiro.id)
    .all<{ id: number; evento_id: number }>();
  return results;
}

// Ids de todas as fotos do retiro em ordem cronológica, com o momento —
// base barata (só inteiros) para amostras estáveis e agrupamentos.
export const SQL_IDS_POR_MOMENTO = `SELECT f.id, f.momento_id FROM fotos f
  WHERE f.retiro_id = ? AND ${SEM_ALBUM_EXCLUSIVO}
  ORDER BY (f.capturada_em IS NULL), f.capturada_em, f.id`;

export async function idsPorMomento(
  db: D1Database,
  retiro: Retiro,
): Promise<{ id: number; momento_id: number | null }[]> {
  const { results } = await db
    .prepare(SQL_IDS_POR_MOMENTO)
    .bind(retiro.id)
    .all<{ id: number; momento_id: number | null }>();
  return results;
}

// ---------------------------------------------------------------------------
// Dados dos chips e das pastas — só o que existe no acervo público.

export const SQL_MOMENTOS_COM_FOTOS = `SELECT m.id, m.nome
   FROM momentos m JOIN fotos f ON f.momento_id = m.id AND ${SEM_ALBUM_EXCLUSIVO}
  WHERE m.retiro_id = ? GROUP BY m.id ORDER BY m.inicio`;

export async function momentosComFotos(
  db: D1Database,
  retiro: Retiro,
): Promise<{ id: number; nome: string }[]> {
  const { results } = await db
    .prepare(SQL_MOMENTOS_COM_FOTOS)
    .bind(retiro.id)
    .all<{ id: number; nome: string }>();
  return results;
}

// Geral = fora dos DOIS sistemas temporais (foto de evento não conta)
export const SQL_TEM_GERAL = `SELECT COUNT(*) AS total FROM fotos f
  WHERE f.retiro_id = ? AND f.momento_id IS NULL AND f.evento_id IS NULL
    AND ${SEM_ALBUM_EXCLUSIVO}`;

export async function temGeral(db: D1Database, retiro: Retiro): Promise<boolean> {
  const linha = await db
    .prepare(SQL_TEM_GERAL)
    .bind(retiro.id)
    .first<{ total: number }>();
  return (linha?.total ?? 0) > 0;
}

export const SQL_MUSICAS_COM_FOTOS = `SELECT DISTINCT m.musica
   FROM momentos m JOIN fotos f ON f.momento_id = m.id AND ${SEM_ALBUM_EXCLUSIVO}
  WHERE m.retiro_id = ? AND m.musica IS NOT NULL ORDER BY m.musica`;

export async function musicasComFotos(
  db: D1Database,
  retiro: Retiro,
): Promise<string[]> {
  const { results } = await db
    .prepare(SQL_MUSICAS_COM_FOTOS)
    .bind(retiro.id)
    .all<{ musica: string }>();
  return results.map((m) => m.musica);
}

// pastas de momento do dia: só as que têm fotos (o público mostra o que tem)
export const SQL_MOMENTOS_DO_DIA = `SELECT m.id, m.nome, m.inicio, COUNT(f.id) AS total
   FROM momentos m JOIN fotos f ON f.momento_id = m.id AND ${SEM_ALBUM_EXCLUSIVO}
  WHERE m.retiro_id = ? AND m.dia = ?
  GROUP BY m.id
  ORDER BY m.inicio`;

export async function momentosDoDiaComFotos(
  db: D1Database,
  retiro: Retiro,
  dia: string,
): Promise<{ id: number; nome: string; inicio: string; total: number }[]> {
  const { results } = await db
    .prepare(SQL_MOMENTOS_DO_DIA)
    .bind(retiro.id, dia)
    .all<{ id: number; nome: string; inicio: string; total: number }>();
  return results;
}
