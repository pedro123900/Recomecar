import {
  calcularRetag,
  type EventoDia,
  type FotoParaRetag,
  type JanelaMomento,
} from "./motor";

// Re-tag retroativo: toda mudança que pode afetar o match (janela salva no
// construtor, datas do retiro editadas, CRUD de eventos de Preparação)
// recalcula a atribuição das fotos do retiro via calcularRetag — única fonte
// do re-tag, nunca SQL nas rotas.
export async function aplicarRetag(db: D1Database, retiroId: number) {
  const { results: fotos } = await db
    .prepare(
      "SELECT id, capturada_em, momento_id, evento_id FROM fotos WHERE retiro_id = ?",
    )
    .bind(retiroId)
    .all<FotoParaRetag>();
  if (fotos.length === 0) return;

  const { results: momentos } = await db
    .prepare("SELECT id, inicio, fim FROM momentos WHERE retiro_id = ?")
    .bind(retiroId)
    .all<JanelaMomento>();
  const { results: eventos } = await db
    .prepare("SELECT id, data, horario FROM eventos WHERE retiro_id = ?")
    .bind(retiroId)
    .all<EventoDia>();

  const mudancas = calcularRetag(fotos, momentos, eventos);
  if (mudancas.length === 0) return;
  await db.batch(
    mudancas.map((m) =>
      db
        // as duas colunas no MESMO statement: o CHECK de exclusividade do
        // schema rejeita a troca de sistema feita em dois UPDATEs
        .prepare("UPDATE fotos SET momento_id = ?, evento_id = ? WHERE id = ?")
        .bind(m.momentoId, m.eventoId, m.fotoId),
    ),
  );
}
