-- 0002 — Remoção do conceito de equipe.
--
-- Uma única equipe (Holly) tira todas as fotos do retiro: a etiqueta teria o
-- mesmo valor em todos os arquivos e não filtraria nada. Conceitualmente
-- tampouco se sustenta: uma foto contém pessoas de várias equipes, e ninguém
-- busca foto por quem segurou a câmera. O upload passa a ser 100% automático
-- (nenhum campo manual); os filtros do site são dia + momento + música.
--
-- Nota de regra de negócio (sem efeito de schema): o offset de relógio,
-- descrito como "do lote" no comentário da 0001, passa a ser por aparelho,
-- identificado pelos metadados EXIF de câmera. Contrato completo no CLAUDE.md.

-- SQLite não derruba coluna indexada: o índice sai antes da coluna.
DROP INDEX idx_fotos_equipe;
ALTER TABLE fotos DROP COLUMN equipe_id;
DROP TABLE equipes;
