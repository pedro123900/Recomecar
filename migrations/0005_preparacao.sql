-- 0005 — Preparação: eventos avulsos datados por edição + evento_id em fotos.
--
-- Segundo sistema de organização do acervo (CLAUDE.md, "Modelo de
-- organização"): eventos de preparação — nome + data + horário opcional. O
-- motor roda em modo dia inteiro (date(capturada_em) = data ⇒ a foto entra
-- sozinha no evento), com precedência do cronograma: momento vence; evento só
-- recebe foto com momento NULL. Com 2+ eventos na mesma data o desempate é
-- encadeado — o último evento com horario <= hora da captura leva; antes do
-- primeiro horário ⇒ primeiro evento do dia — e exige horários distintos
-- (regra da validação do admin).
--
-- Regra do sistema temporal único (fechada em 21/08/2026): cada foto vive em
-- exatamente UM sistema temporal — momento → evento → Geral. Os CHECKs novos
-- de fotos gravam isso no schema: momento_id e evento_id mutuamente
-- exclusivos, e evento exige capturada_em (sem EXIF o motor não atribui).
-- Consequência para o re-tag: a transição evento→momento troca as DUAS
-- colunas no mesmo UPDATE, ou o CHECK rejeita.
--
-- Por que recriar fotos em vez de ALTER: os CHECKs novos são de tabela
-- (cruzam colunas) e o SQLite não adiciona CHECK via ALTER TABLE. Nenhuma
-- tabela referencia fotos — as FKs dela apontam para fora, são declaradas na
-- tabela nova e sobrevivem ao RENAME (padrão da 0003). Formato de data/hora e
-- comparação: os mesmos da 0001. Índices recriados ao final.

CREATE TABLE eventos (
  id        INTEGER PRIMARY KEY,
  retiro_id INTEGER NOT NULL REFERENCES retiros (id) ON DELETE CASCADE,
  nome      TEXT    NOT NULL,
  -- modo dia inteiro: o motor casa por date(capturada_em) = data
  data      TEXT    NOT NULL CHECK (date(data) IS data),
  -- desempate encadeado quando há 2+ eventos na data; canônico 'HH:MM:SS'
  horario   TEXT             CHECK (horario IS NULL OR
                             strftime('%H:%M:%S', horario) IS horario),
  -- defesa em camadas para "2+ eventos na data ⇒ horários preenchidos e
  -- distintos": o UNIQUE pega a duplicata exata; o índice parcial abaixo pega
  -- dois eventos SEM horário na mesma data (que passariam pela regra de NULL
  -- do UNIQUE) — o caso mais ambíguo para o desempate encadeado; o caso misto
  -- (um com horário, um sem) fica na validação do admin. O UNIQUE já indexa
  -- (retiro_id, data) por prefixo; não precisa de índice próprio.
  UNIQUE (retiro_id, data, horario)
) STRICT;

CREATE UNIQUE INDEX idx_eventos_data_sem_horario
  ON eventos (retiro_id, data) WHERE horario IS NULL;

CREATE TABLE fotos_novo (
  id           INTEGER PRIMARY KEY,
  -- RESTRICT: retiro com mídia não se apaga por engano; primeiro remove-se a
  -- mídia (com a limpeza correspondente no R2)
  retiro_id    INTEGER NOT NULL REFERENCES retiros (id) ON DELETE RESTRICT,
  -- chave do original no R2; derivadas são função pura desta chave
  arquivo_r2   TEXT    NOT NULL UNIQUE,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('foto', 'video')),
  -- EXIF já com offset de relógio do aparelho aplicado. NULL = sem data de
  -- captura confiável (nunca substituir por mtime) => sem momento nem evento
  capturada_em TEXT             CHECK (capturada_em IS NULL OR
                                strftime('%Y-%m-%d %H:%M:%S', capturada_em) IS capturada_em),
  -- SET NULL: apagar um momento manda as fotos dele para "Geral" até o
  -- re-tag seguinte
  momento_id   INTEGER          REFERENCES momentos (id) ON DELETE SET NULL,
  -- SET NULL: apagar um evento devolve as fotos ao "Geral" até o re-tag
  evento_id    INTEGER          REFERENCES eventos (id) ON DELETE SET NULL,
  largura      INTEGER NOT NULL CHECK (largura > 0),
  altura       INTEGER NOT NULL CHECK (altura > 0),
  -- segundos; só vídeos
  duracao      REAL             CHECK (duracao IS NULL OR (tipo = 'video' AND duracao > 0)),
  -- EXIF de câmera (Make/Model/BodySerialNumber) — âncora do offset por aparelho
  aparelho_marca  TEXT,
  aparelho_modelo TEXT,
  aparelho_serial TEXT,
  -- sem data de captura o motor não tem como atribuir momento nem evento
  CHECK (capturada_em IS NOT NULL OR momento_id IS NULL),
  CHECK (capturada_em IS NOT NULL OR evento_id IS NULL),
  -- sistema temporal único: momento vence; a transição evento→momento troca
  -- as duas colunas no mesmo UPDATE
  CHECK (momento_id IS NULL OR evento_id IS NULL)
) STRICT;

-- cópia fiel; evento_id nasce NULL — nenhum evento existe antes desta migration
INSERT INTO fotos_novo (id, retiro_id, arquivo_r2, tipo, capturada_em,
                        momento_id, evento_id, largura, altura, duracao,
                        aparelho_marca, aparelho_modelo, aparelho_serial)
SELECT id, retiro_id, arquivo_r2, tipo, capturada_em,
       momento_id, NULL, largura, altura, duracao,
       aparelho_marca, aparelho_modelo, aparelho_serial
FROM fotos;

DROP TABLE fotos;

ALTER TABLE fotos_novo RENAME TO fotos;

CREATE INDEX idx_fotos_retiro_capturada ON fotos (retiro_id, capturada_em);
CREATE INDEX idx_fotos_momento ON fotos (momento_id);
CREATE INDEX idx_fotos_evento ON fotos (evento_id);
