// Consultas compartilhadas pelas rotas públicas da edição (Bloco A).
// Toda lógica de regra vive nas funções puras (faixas.ts, galeria.ts);
// aqui é só SQL com binds e montagem de itens.

import { faixasDosDias, type FaixaDia } from "./faixas";
import {
  diasDoRetiro,
  itemGaleria,
  type ItemGaleria,
  type LinhaFotoGaleria,
} from "./galeria";
import type { Retiro } from "./tipos";

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
  WHERE f.retiro_id = ?`;

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
export async function eventosComFotos(
  db: D1Database,
  retiro: Retiro,
): Promise<{ id: number; nome: string; data: string; total: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.nome, e.data, COUNT(f.id) AS total
         FROM eventos e JOIN fotos f ON f.evento_id = e.id
        WHERE e.retiro_id = ?
        GROUP BY e.id ORDER BY e.data, e.horario, e.id`,
    )
    .bind(retiro.id)
    .all<{ id: number; nome: string; data: string; total: number }>();
  return results;
}

// Ids das fotos de evento em ordem cronológica — base barata (só inteiros)
// para as amostras estáveis da seção Preparação da capa.
export async function idsPorEvento(
  db: D1Database,
  retiro: Retiro,
): Promise<{ id: number; evento_id: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT f.id, f.evento_id FROM fotos f
        WHERE f.retiro_id = ? AND f.evento_id IS NOT NULL
        ORDER BY (f.capturada_em IS NULL), f.capturada_em, f.id`,
    )
    .bind(retiro.id)
    .all<{ id: number; evento_id: number }>();
  return results;
}

// Ids de todas as fotos do retiro em ordem cronológica, com o momento —
// base barata (só inteiros) para amostras estáveis e agrupamentos.
export async function idsPorMomento(
  db: D1Database,
  retiro: Retiro,
): Promise<{ id: number; momento_id: number | null }[]> {
  const { results } = await db
    .prepare(
      `SELECT f.id, f.momento_id FROM fotos f WHERE f.retiro_id = ?
       ORDER BY (f.capturada_em IS NULL), f.capturada_em, f.id`,
    )
    .bind(retiro.id)
    .all<{ id: number; momento_id: number | null }>();
  return results;
}
