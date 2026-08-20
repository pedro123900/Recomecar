// Herança de dia lógico por faixa (Bloco A, decisão de 20/08/2026):
// foto sem momento ("Geral") pertence à pasta do dia cuja faixa contém
// capturada_em — não existe pasta "Geral" na navegação. Nada é persistido:
// as faixas são recalculadas na exibição a partir do cronograma.
//
// Faixa do dia N (contrato no CLAUDE.md, "Motor de tags"):
//  - do primeiro momento do dia N até o primeiro momento do dia N+1;
//  - teto no fim do dia de calendário SEGUINTE a N — a faixa do pré não
//    engole a semana até a sexta, e o último dia cobre a manhã de
//    desmontagem do dia seguinte;
//  - complemento: foto antes do primeiro momento, no mesmo dia de
//    calendário (chegada, montagem), pertence ao dia — o piso desce à
//    meia-noite do próprio dia quando o dia anterior não reivindica o
//    trecho (primeiro dia lógico ou depois de um buraco de calendário).
// Datas/horas no formato canônico da migration 0001; comparação lexicográfica.

import { adicionarDias } from "./cronograma";

export interface FaixaDia {
  data: string; // dia lógico 'YYYY-MM-DD'
  inicio: string; // datetime inclusivo
  fim: string; // datetime exclusivo
}

export function faixasDosDias(
  dias: string[],
  momentos: { dia: string; inicio: string }[],
): FaixaDia[] {
  const ordenados = [...dias].sort();
  const primeiroMomento = new Map<string, string>();
  for (const m of momentos) {
    const atual = primeiroMomento.get(m.dia);
    if (!atual || m.inicio < atual) primeiroMomento.set(m.dia, m.inicio);
  }
  // dia sem momento nenhum (cronograma incompleto): a meia-noite é o piso
  const pisos = ordenados.map(
    (d) => primeiroMomento.get(d) ?? `${d} 00:00:00`,
  );

  const faixas: FaixaDia[] = [];
  for (let i = 0; i < ordenados.length; i++) {
    const dia = ordenados[i];
    const tetoCalendario = `${adicionarDias(dia, 2)} 00:00:00`;
    const proximoPiso = i + 1 < ordenados.length ? pisos[i + 1] : null;
    const fim =
      proximoPiso && proximoPiso < tetoCalendario ? proximoPiso : tetoCalendario;

    const meiaNoite = `${dia} 00:00:00`;
    const fimAnterior = i > 0 ? faixas[i - 1].fim : null;
    const base =
      fimAnterior && fimAnterior > meiaNoite ? fimAnterior : meiaNoite;
    const inicio = base < pisos[i] ? base : pisos[i];

    faixas.push({ data: dia, inicio, fim });
  }
  return faixas;
}

export function diaDaFoto(
  faixas: FaixaDia[],
  capturadaEm: string | null,
): string | null {
  if (!capturadaEm) return null;
  for (const f of faixas) {
    if (capturadaEm >= f.inicio && capturadaEm < f.fim) return f.data;
  }
  return null;
}
