// Motor de tags por cronograma. Convenções da migration 0001: datetimes
// TEXT 'YYYY-MM-DD HH:MM:SS', comparação lexicográfica.

export interface JanelaMomento {
  id: number;
  inicio: string;
  fim: string;
}

export interface FotoParaRetag {
  id: number;
  capturada_em: string | null;
  momento_id: number | null;
  evento_id: number | null;
}

// A mudança carrega SEMPRE as duas colunas: o CHECK de exclusividade do
// schema exige que a troca de sistema (evento→momento e vice-versa) chegue
// ao banco num único UPDATE.
export interface MudancaRetag {
  fotoId: number;
  momentoId: number | null;
  eventoId: number | null;
}

// Devolve somente as fotos cuja atribuição mudou — o chamador aplica os
// UPDATEs em batch mínimo. É a única fonte do re-tag: construtor de
// cronograma e CRUD de eventos chamam esta função ao salvar, nunca SQL próprio.
export function calcularRetag(
  fotos: FotoParaRetag[],
  momentos: JanelaMomento[],
  eventos: EventoDia[],
): MudancaRetag[] {
  const mudancas: MudancaRetag[] = [];
  for (const foto of fotos) {
    const { momentoId, eventoId } = atribuirTemporal(
      foto.capturada_em,
      momentos,
      eventos,
    );
    if (momentoId !== foto.momento_id || eventoId !== foto.evento_id) {
      mudancas.push({ fotoId: foto.id, momentoId, eventoId });
    }
  }
  return mudancas;
}

export interface EventoDia {
  id: number;
  data: string; // 'YYYY-MM-DD'
  horario: string | null; // 'HH:MM:SS'
}

// Modo dia inteiro (Preparação): casa por date(capturada_em) = data. Com 2+
// eventos na data, desempate encadeado: o último evento com horario <= hora
// da captura leva; antes do primeiro horário => primeiro evento do dia. As
// camadas de schema/admin garantem horários preenchidos e distintos nesse
// caso; horario null entra como início do dia só por determinismo.
export function atribuirEvento(
  capturadaEm: string | null,
  eventos: EventoDia[],
): number | null {
  if (capturadaEm === null) return null;
  const data = capturadaEm.slice(0, 10);
  const hora = capturadaEm.slice(11);
  const doDia = eventos
    .filter((e) => e.data === data)
    .sort((a, b) => {
      const ha = a.horario ?? "00:00:00";
      const hb = b.horario ?? "00:00:00";
      return ha < hb ? -1 : ha > hb ? 1 : a.id - b.id;
    });
  if (doDia.length === 0) return null;
  let escolhido = doDia[0];
  for (const e of doDia) {
    if ((e.horario ?? "00:00:00") <= hora) escolhido = e;
  }
  return escolhido.id;
}

export interface AtribuicaoTemporal {
  momentoId: number | null;
  eventoId: number | null;
}

// Sistema temporal único (CLAUDE.md, decisão de 21/08/2026): cada foto vive
// em exatamente um sistema — momento → evento → Geral. Momento vence (janela
// de hora é mais específica que dia); evento só recebe foto com momento null.
export function atribuirTemporal(
  capturadaEm: string | null,
  momentos: JanelaMomento[],
  eventos: EventoDia[],
): AtribuicaoTemporal {
  const momentoId = atribuirMomento(capturadaEm, momentos);
  if (momentoId !== null) return { momentoId, eventoId: null };
  return { momentoId: null, eventoId: atribuirEvento(capturadaEm, eventos) };
}

// "Geral" = fora dos dois sistemas; só ela participa da herança de dia por
// faixa (faixas.ts) — foto de evento fica fora das pastas e da linha do tempo.
export function ehGeral(atribuicao: AtribuicaoTemporal): boolean {
  return atribuicao.momentoId === null && atribuicao.eventoId === null;
}

export function atribuirMomento(
  capturadaEm: string | null,
  momentos: JanelaMomento[],
): number | null {
  // Sobreposição: devolve o de menor inicio — comportamento PROVISÓRIO desta
  // fase (determinístico, não decidido). O desempate definitivo é da próxima
  // fase do motor; a direção provável é a inversa (janela mais específica).
  const ordenados = [...momentos].sort((a, b) =>
    a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : a.id - b.id,
  );
  for (const m of ordenados) {
    if (capturadaEm !== null && m.inicio <= capturadaEm && capturadaEm < m.fim) {
      return m.id;
    }
  }
  return null;
}
