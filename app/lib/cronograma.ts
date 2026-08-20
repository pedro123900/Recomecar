// Convenções da migration 0001: data 'YYYY-MM-DD', datetime
// 'YYYY-MM-DD HH:MM:SS', comparação lexicográfica válida nesses formatos.

export function adicionarDias(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Dias lógicos do retiro: datas EXPLÍCITAS, uma por dia — pré-retiro
// opcional + três dias obrigatórios. Nenhuma inferência de intervalo: a
// função só lista o que está preenchido, na ordem dos campos. O buraco de
// ~uma semana entre o pré e a sexta é normal (fotos nele => "Geral").
export function listarDiasLogicos(retiro: {
  data_pre: string | null;
  data_dia1: string;
  data_dia2: string;
  data_dia3: string;
}): string[] {
  return [retiro.data_pre, retiro.data_dia1, retiro.data_dia2, retiro.data_dia3]
    .filter((d): d is string => d !== null && d !== "");
}

// Datas do retiro editadas com cronograma existente: momentos cujo dia lógico
// saiu do conjunto de dias são apontados para aviso (nunca bloqueio).
export function momentosForaDosDias<T extends { dia: string }>(
  momentos: T[],
  dias: string[],
): T[] {
  return momentos.filter((m) => !dias.includes(m.dia));
}

// Resolve um 'HH:MM' digitado para datetime completo dentro do dia lógico.
// Virada da meia-noite: horário menor que o da referência anterior (último
// início do dia, ou o próprio início quando se resolve um fim) significa
// +1 dia no calendário, mantendo o dia lógico da aba.
export function resolverDatetime(
  diaLogico: string,
  referenciaAnterior: string | null,
  hora: string,
): string {
  const base = referenciaAnterior ? referenciaAnterior.slice(0, 10) : diaLogico;
  const candidato = `${base} ${hora}:00`;
  if (referenciaAnterior && candidato < referenciaAnterior) {
    return `${adicionarDias(base, 1)} ${hora}:00`;
  }
  return candidato;
}

export interface MomentoJanela {
  id: number;
  nome: string;
  inicio: string;
  fim: string;
}

export interface Aviso {
  tipo: "buraco" | "sobreposicao";
  entre: [string, string];
}

// Avisos entre momentos adjacentes (ordenados por início) de um dia lógico.
// Encadeamento perfeito é fim === início do próximo (janela semiaberta).
export function calcularAvisos(momentos: MomentoJanela[]): Aviso[] {
  const ordenados = [...momentos].sort((a, b) =>
    a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0,
  );
  const avisos: Aviso[] = [];
  for (let i = 0; i < ordenados.length - 1; i++) {
    const atual = ordenados[i];
    const proximo = ordenados[i + 1];
    if (atual.fim < proximo.inicio) {
      avisos.push({ tipo: "buraco", entre: [atual.nome, proximo.nome] });
    } else if (atual.fim > proximo.inicio) {
      avisos.push({ tipo: "sobreposicao", entre: [atual.nome, proximo.nome] });
    }
  }
  return avisos;
}
