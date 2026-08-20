// Montagem dos itens da grade pública: URLs via urlMidia e alt automático
// derivado das tags (piso de acessibilidade do DESIGN.md — nenhuma mídia
// sem texto alternativo).

import { chavesDerivadas } from "./chaves-r2";
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
  retiroTitulo: string;
}): string {
  const prefixo = foto.tipo === "video" ? "Vídeo" : "Foto";
  const partes = [foto.momentoNome ?? "Geral / Bastidores"];
  // sem momento não há dia lógico confiável (herança de dia pelos
  // bastidores é refinamento da fase do motor)
  if (foto.momentoDia) partes.push(dataPorExtensoPtBr(foto.momentoDia));
  partes.push(foto.retiroTitulo);
  return `${prefixo} — ${partes.join(", ")}`;
}

// Linha do SELECT da grade (fotos LEFT JOIN momentos).
export interface LinhaFotoGaleria {
  id: number;
  arquivo_r2: string;
  tipo: "foto" | "video";
  largura: number;
  altura: number;
  duracao: number | null;
  momento_nome: string | null;
  momento_dia: string | null;
}

export interface ItemGaleria {
  id: number;
  tipo: "foto" | "video";
  urlExibicao: string;
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
  return {
    id: linha.id,
    tipo: linha.tipo,
    urlExibicao: urlMidia(exibicao, basePublica),
    urlDownload: urlMidia(linha.arquivo_r2, basePublica),
    largura: linha.largura,
    altura: linha.altura,
    legenda: linha.momento_nome ?? "Geral / Bastidores",
    alt: textoAlternativo({
      tipo: linha.tipo,
      momentoNome: linha.momento_nome,
      momentoDia: linha.momento_dia,
      retiroTitulo,
    }),
  };
}
