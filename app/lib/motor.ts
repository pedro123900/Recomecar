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
}

export interface MudancaRetag {
  fotoId: number;
  momentoId: number | null;
}

// Devolve somente as fotos cujo momento mudou — o chamador aplica os UPDATEs
// em batch mínimo. É a única fonte do re-tag: o construtor de cronograma
// chama esta função ao salvar, nunca SQL próprio.
export function calcularRetag(
  fotos: FotoParaRetag[],
  momentos: JanelaMomento[],
): MudancaRetag[] {
  const mudancas: MudancaRetag[] = [];
  for (const foto of fotos) {
    const momentoId = atribuirMomento(foto.capturada_em, momentos);
    if (momentoId !== foto.momento_id) {
      mudancas.push({ fotoId: foto.id, momentoId });
    }
  }
  return mudancas;
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
