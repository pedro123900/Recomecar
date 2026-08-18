import { calcularRetag, type FotoParaRetag, type JanelaMomento } from "./motor";

// Re-tag retroativo: toda mudança que pode afetar o match (janela salva no
// construtor, datas do retiro editadas) recalcula o momento das fotos do
// retiro via calcularRetag — única fonte do re-tag, nunca SQL nas rotas.
export async function aplicarRetag(db: D1Database, retiroId: number) {
  const { results: fotos } = await db
    .prepare("SELECT id, capturada_em, momento_id FROM fotos WHERE retiro_id = ?")
    .bind(retiroId)
    .all<FotoParaRetag>();
  if (fotos.length === 0) return;

  const { results: momentos } = await db
    .prepare("SELECT id, inicio, fim FROM momentos WHERE retiro_id = ?")
    .bind(retiroId)
    .all<JanelaMomento>();

  const mudancas = calcularRetag(fotos, momentos);
  if (mudancas.length === 0) return;
  await db.batch(
    mudancas.map((m) =>
      db
        .prepare("UPDATE fotos SET momento_id = ? WHERE id = ?")
        .bind(m.momentoId, m.fotoId),
    ),
  );
}
