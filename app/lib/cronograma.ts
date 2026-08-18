// Convenções da migration 0001: data 'YYYY-MM-DD', datetime
// 'YYYY-MM-DD HH:MM:SS', comparação lexicográfica válida nesses formatos.

export function adicionarDias(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function listarDias(dataInicio: string, dataFim: string): string[] {
  const dias: string[] = [];
  for (let d = dataInicio; d <= dataFim; d = adicionarDias(d, 1)) {
    dias.push(d);
  }
  return dias;
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
