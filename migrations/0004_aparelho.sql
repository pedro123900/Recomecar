-- 0004 — Metadados de aparelho por foto (âncora do offset de relógio).
--
-- O offset por aparelho (CLAUDE.md) agrupa fotos pelo aparelho que as tirou
-- (EXIF Make/Model/BodySerialNumber). Sem colher isso no upload, recolher
-- depois exigiria reler todos os arquivos originais. Este item só COLETA:
-- a tela de manutenção do offset fica para a fase do motor. Campos
-- opcionais — nem todo arquivo tem EXIF de câmera.

ALTER TABLE fotos ADD COLUMN aparelho_marca  TEXT;
ALTER TABLE fotos ADD COLUMN aparelho_modelo TEXT;
ALTER TABLE fotos ADD COLUMN aparelho_serial TEXT;
