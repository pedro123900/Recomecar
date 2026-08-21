// Regras puras do CRUD de eventos de Preparação (CLAUDE.md, "Modelo de
// organização do acervo", item 2). Camadas: o schema pega duplicata exata e
// dois sem-horário na mesma data; o caso misto e a mensagem amigável vivem
// aqui, chamadas pela action do admin.

// <input type="time"> entrega 'HH:MM'; o canônico do banco é 'HH:MM:SS'.
export function normalizarHorario(bruto: string): string | null {
  const limpo = bruto.trim();
  if (limpo === "") return null;
  return /^\d\d:\d\d$/.test(limpo) ? `${limpo}:00` : limpo;
}

// Bloqueio (não aviso): com 2+ eventos na mesma data o desempate encadeado
// exige horários preenchidos e distintos. `existentesNaData` são os OUTROS
// eventos do retiro naquela data (na edição, excluir o próprio).
export function validarHorarioNaData(
  horario: string | null,
  existentesNaData: { horario: string | null }[],
): string | null {
  if (existentesNaData.length === 0) return null;
  if (horario === null || existentesNaData.some((e) => e.horario === null)) {
    return "Com mais de um evento na mesma data, todos precisam de horário.";
  }
  if (existentesNaData.some((e) => e.horario === horario)) {
    return "Já existe evento nesta data com este horário.";
  }
  return null;
}

// Aviso (não bloqueio), padrão do construtor de cronograma: evento em data
// que é dia lógico do retiro — o momento vence, o evento só recebe o que
// sobrar fora das janelas.
export function eventosEmDiasLogicos<T extends { data: string }>(
  eventos: T[],
  dias: string[],
): T[] {
  return eventos.filter((e) => dias.includes(e.data));
}
