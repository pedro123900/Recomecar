// Montagem dos itens da grade pública: URLs via urlMidia e alt automático
// derivado das tags (piso de acessibilidade do DESIGN.md — nenhuma mídia
// sem texto alternativo).

import { chavesDerivadas } from "./chaves-r2";
import type { FaixaDia } from "./faixas";
import { urlMidia } from "./midia";

const DIAS_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// 'YYYY-MM-DD' -> "sexta-feira, 25 de setembro de 2026". Tabelas fixas em
// vez de Intl: determinístico em node (vitest) e no worker.
export function dataPorExtensoPtBr(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  const semana = DIAS_SEMANA[d.getUTCDay()];
  const mes = MESES[d.getUTCMonth()];
  return `${semana}, ${d.getUTCDate()} de ${mes} de ${d.getUTCFullYear()}`;
}

export function textoAlternativo(foto: {
  tipo: "foto" | "video";
  momentoNome: string | null;
  momentoDia: string | null;
  // evento de Preparação (sistema temporal único: nunca coexiste com momento;
  // se ambos chegarem, momento vence — mesmo desempate do motor)
  eventoNome?: string | null;
  eventoData?: string | null;
  retiroTitulo: string;
}): string {
  const prefixo = foto.tipo === "video" ? "Vídeo" : "Foto";
  const partes: string[] = [];
  if (foto.momentoNome) {
    partes.push(foto.momentoNome);
    if (foto.momentoDia) partes.push(dataPorExtensoPtBr(foto.momentoDia));
  } else if (foto.eventoNome) {
    partes.push(foto.eventoNome);
    if (foto.eventoData) partes.push(dataPorExtensoPtBr(foto.eventoData));
  } else {
    partes.push("Geral");
  }
  partes.push(foto.retiroTitulo);
  return `${prefixo} — ${partes.join(", ")}`;
}

// Linha do SELECT da grade (fotos LEFT JOIN momentos LEFT JOIN eventos).
export interface LinhaFotoGaleria {
  id: number;
  arquivo_r2: string;
  tipo: "foto" | "video";
  largura: number;
  altura: number;
  duracao: number | null;
  momento_nome: string | null;
  momento_dia: string | null;
  evento_nome: string | null;
  evento_data: string | null;
}

export interface ItemGaleria {
  id: number;
  tipo: "foto" | "video";
  urlExibicao: string;
  // lightbox: média 1600 para foto; vídeo toca o original (não há média)
  urlAmpliada: string;
  urlDownload: string;
  largura: number;
  altura: number;
  legenda: string;
  alt: string;
}

export function itemGaleria(
  linha: LinhaFotoGaleria,
  retiroTitulo: string,
  basePublica: string | undefined,
): ItemGaleria {
  const derivadas = chavesDerivadas(linha.arquivo_r2);
  const exibicao = linha.tipo === "video" ? derivadas.poster : derivadas.thumb;
  const ampliada = linha.tipo === "video" ? linha.arquivo_r2 : derivadas.media;
  return {
    id: linha.id,
    tipo: linha.tipo,
    urlExibicao: urlMidia(exibicao, basePublica),
    urlAmpliada: urlMidia(ampliada, basePublica),
    urlDownload: urlMidia(linha.arquivo_r2, basePublica),
    largura: linha.largura,
    altura: linha.altura,
    legenda: linha.momento_nome ?? linha.evento_nome ?? "Geral",
    alt: textoAlternativo({
      tipo: linha.tipo,
      momentoNome: linha.momento_nome,
      momentoDia: linha.momento_dia,
      eventoNome: linha.evento_nome,
      eventoData: linha.evento_data,
      retiroTitulo,
    }),
  };
}

// ---------------------------------------------------------------------------
// Bloco A: amostra estável, dias ordinais, filtros da grade, paginação e
// blocos da linha do tempo — tudo função pura, testada em galeria.test.ts.

// Hash FNV-1a de 32 bits — semente textual -> inteiro para o PRNG.
function hash32(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: PRNG determinístico pequeno; suficiente para amostra visual.
function prng(semente: number): () => number {
  let a = semente;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Amostra de n itens com semente estável: mesma semente => mesma amostra em
// toda visita (regra da linha do tempo — nunca aleatório por carregamento).
// A saída preserva a ordem original (cronológica) dos itens.
export function amostraEstavel<T>(itens: T[], n: number, semente: string): T[] {
  if (itens.length <= n) return [...itens];
  const sorteio = prng(hash32(semente));
  const indices = itens.map((_, i) => i);
  // Fisher-Yates parcial: só as n primeiras posições precisam sortear
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(sorteio() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices
    .slice(0, n)
    .sort((a, b) => a - b)
    .map((i) => itens[i]);
}

export type OrdinalDia = "pre" | "dia-1" | "dia-2" | "dia-3";

export interface DiaDoRetiro {
  ordinal: OrdinalDia;
  data: string;
  rotulo: string;
}

export function diasDoRetiro(retiro: {
  data_pre: string | null;
  data_dia1: string;
  data_dia2: string;
  data_dia3: string;
}): DiaDoRetiro[] {
  const dias: DiaDoRetiro[] = [];
  if (retiro.data_pre) {
    dias.push({ ordinal: "pre", data: retiro.data_pre, rotulo: "Pré-retiro" });
  }
  dias.push(
    { ordinal: "dia-1", data: retiro.data_dia1, rotulo: "Dia 1" },
    { ordinal: "dia-2", data: retiro.data_dia2, rotulo: "Dia 2" },
    { ordinal: "dia-3", data: retiro.data_dia3, rotulo: "Dia 3" },
  );
  return dias;
}

// Filtros da grade única (/retiros/:edicao/fotos). "geral" = fora dos dois
// sistemas temporais. "evento" (Preparação) é excludente com os demais: foto
// de evento tem momento null por construção — combinar não significa nada.
// "album" (Bloco C) idem, e ainda mais forte: é sobreposição curada, fora do
// tempo, com ordem manual — excludente com tudo, inclusive com o evento.
export interface FiltrosGrade {
  dia?: OrdinalDia;
  momento?: number | "geral";
  musica?: string;
  evento?: number;
  album?: number;
}

// Query string crua -> filtros normalizados; valor inválido é descartado em
// silêncio (chips geram URLs válidas; URL editada à mão não derruba a página).
export function analisarFiltros(
  brutos: {
    dia?: string;
    momento?: string;
    musica?: string;
    evento?: string;
    album?: string;
  },
  dias: DiaDoRetiro[],
): FiltrosGrade {
  if (brutos.album && /^[1-9]\d*$/.test(brutos.album)) {
    return { album: Number(brutos.album) };
  }
  if (brutos.evento && /^[1-9]\d*$/.test(brutos.evento)) {
    return { evento: Number(brutos.evento) };
  }
  const filtros: FiltrosGrade = {};
  if (brutos.dia && dias.some((d) => d.ordinal === brutos.dia)) {
    filtros.dia = brutos.dia as OrdinalDia;
  }
  if (brutos.momento === "geral") {
    filtros.momento = "geral";
  } else if (brutos.momento && /^[1-9]\d*$/.test(brutos.momento)) {
    filtros.momento = Number(brutos.momento);
  }
  if (brutos.musica) filtros.musica = brutos.musica;
  return filtros;
}

// Fragmento WHERE + binds para a consulta da grade (f = fotos, m = momentos).
// Filtro de dia inclui a herança por faixa: momentos do dia OU fotos sem
// momento cuja captura cai na faixa do dia.
export function condicoesGrade(
  filtros: FiltrosGrade,
  faixas: FaixaDia[],
  dias: DiaDoRetiro[],
): { sql: string; binds: (string | number)[] } {
  const partes: string[] = [];
  const binds: (string | number)[] = [];

  if (filtros.dia) {
    const data = dias.find((d) => d.ordinal === filtros.dia)!.data;
    const faixa = faixas.find((f) => f.data === data);
    if (faixa) {
      // herança de faixa só alcança foto Geral: foto de evento fica fora
      // (sistema temporal único)
      partes.push(
        "(m.dia = ? OR (f.momento_id IS NULL AND f.evento_id IS NULL AND f.capturada_em >= ? AND f.capturada_em < ?))",
      );
      binds.push(data, faixa.inicio, faixa.fim);
    } else {
      partes.push("m.dia = ?");
      binds.push(data);
    }
  }
  if (filtros.momento === "geral") {
    partes.push("f.momento_id IS NULL AND f.evento_id IS NULL");
  } else if (typeof filtros.momento === "number") {
    partes.push("f.momento_id = ?");
    binds.push(filtros.momento);
  }
  if (filtros.musica) {
    partes.push("m.musica = ?");
    binds.push(filtros.musica);
  }
  if (filtros.evento) {
    partes.push("f.evento_id = ?");
    binds.push(filtros.evento);
  }
  return { sql: partes.join(" AND "), binds };
}

export const FOTOS_POR_PAGINA = 120;

export function paginar(
  total: number,
  paginaBruta: string | undefined,
  porPagina = FOTOS_POR_PAGINA,
): { pagina: number; paginas: number; offset: number } {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pedida = Number(paginaBruta);
  const pagina = Number.isInteger(pedida)
    ? Math.min(Math.max(pedida, 1), paginas)
    : 1;
  return { pagina, paginas, offset: (pagina - 1) * porPagina };
}

// Linha do tempo: um bloco por momento COM fotos, em ordem cronológica.
// Fotos sem momento não aparecem aqui (a linha do tempo é a narrativa do
// cronograma) — só nas pastas do dia e na grade.
export interface BlocoLinhaDoTempo {
  momentoId: number;
  nome: string;
  dia: string;
  musica: string | null;
  total: number;
}

export function blocosLinhaDoTempo(
  momentos: {
    id: number;
    nome: string;
    dia: string;
    inicio: string;
    musica: string | null;
  }[],
  contagens: Record<number, number>,
): BlocoLinhaDoTempo[] {
  return [...momentos]
    .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0))
    .filter((m) => (contagens[m.id] ?? 0) > 0)
    .map((m) => ({
      momentoId: m.id,
      nome: m.nome,
      dia: m.dia,
      musica: m.musica,
      total: contagens[m.id],
    }));
}
