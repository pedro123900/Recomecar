-- 0001 — Schema inicial (fatia vertical do motor de tags).
--
-- Convenções de que o motor de tags depende (não mudar sem migration):
--  - Data:     TEXT 'YYYY-MM-DD'.
--  - Datetime: TEXT 'YYYY-MM-DD HH:MM:SS', horário local do retiro, sem fuso.
--    EXIF e cronograma são ambos relógio de parede; o match dia/momento é
--    comparação lexicográfica de strings, válida somente neste formato
--    canônico — os CHECKs de formato rejeitam variantes ('T', sufixo 'Z',
--    formato EXIF '2026:09:25 ...', datetime sem segundos).
--  - Booleano: INTEGER 0/1.

CREATE TABLE retiros (
  id                  INTEGER PRIMARY KEY,
  serie               TEXT    NOT NULL CHECK (serie IN ('Recomeçar', 'Renascer')),
  numero              INTEGER NOT NULL CHECK (numero >= 1),
  -- slug entra em URL e em chave R2: somente [0-9a-z-]
  slug                TEXT    NOT NULL UNIQUE
                              CHECK (slug <> '' AND slug NOT GLOB '*[^0-9a-z-]*'),
  titulo              TEXT    NOT NULL,
  data_inicio         TEXT    NOT NULL CHECK (date(data_inicio) IS data_inicio),
  data_fim            TEXT    NOT NULL CHECK (date(data_fim) IS data_fim),
  padroeiro_nome      TEXT,
  padroeiro_invocacao TEXT,
  -- preenchido e sem mídia no acervo => card abre o Drive externo (nova aba)
  link_drive          TEXT,
  -- JSON com as cores da edição; NULL => tema padrão
  tema                TEXT             CHECK (tema IS NULL OR json_valid(tema)),
  publicado           INTEGER NOT NULL DEFAULT 0 CHECK (publicado IN (0, 1)),
  UNIQUE (serie, numero),
  CHECK (data_inicio <= data_fim)
) STRICT;

CREATE TABLE equipes (
  id   INTEGER PRIMARY KEY,
  nome TEXT NOT NULL COLLATE NOCASE UNIQUE
) STRICT;

CREATE TABLE momentos (
  id        INTEGER PRIMARY KEY,
  retiro_id INTEGER NOT NULL REFERENCES retiros (id) ON DELETE CASCADE,
  nome      TEXT    NOT NULL,
  -- dia lógico (aba do construtor); não derivável de inicio: uma vigília pode
  -- cruzar a meia-noite e continuar pertencendo ao dia anterior
  dia       TEXT    NOT NULL CHECK (date(dia) IS dia),
  inicio    TEXT    NOT NULL CHECK (strftime('%Y-%m-%d %H:%M:%S', inicio) IS inicio),
  fim       TEXT    NOT NULL CHECK (strftime('%Y-%m-%d %H:%M:%S', fim) IS fim),
  musica    TEXT,
  -- janela semiaberta: inicio <= capturada_em < fim
  CHECK (inicio < fim)
) STRICT;

CREATE INDEX idx_momentos_retiro_inicio ON momentos (retiro_id, inicio);

CREATE TABLE fotos (
  id           INTEGER PRIMARY KEY,
  -- RESTRICT: retiro com mídia não se apaga por engano; primeiro remove-se a
  -- mídia (com a limpeza correspondente no R2)
  retiro_id    INTEGER NOT NULL REFERENCES retiros (id) ON DELETE RESTRICT,
  -- chave do original no R2; derivadas são função pura desta chave
  arquivo_r2   TEXT    NOT NULL UNIQUE,
  tipo         TEXT    NOT NULL CHECK (tipo IN ('foto', 'video')),
  -- EXIF já com offset de relógio do lote aplicado. NULL = sem data de captura
  -- confiável (nunca substituir por mtime) => momento_id NULL => "Geral / Bastidores"
  capturada_em TEXT             CHECK (capturada_em IS NULL OR
                                strftime('%Y-%m-%d %H:%M:%S', capturada_em) IS capturada_em),
  -- SET NULL: apagar um momento manda as fotos dele para Bastidores até o
  -- re-tag seguinte
  momento_id   INTEGER          REFERENCES momentos (id) ON DELETE SET NULL,
  -- RESTRICT: equipe referenciada por fotos não sai do catálogo
  equipe_id    INTEGER          REFERENCES equipes (id) ON DELETE RESTRICT,
  largura      INTEGER NOT NULL CHECK (largura > 0),
  altura       INTEGER NOT NULL CHECK (altura > 0),
  -- segundos; só vídeos
  duracao      REAL             CHECK (duracao IS NULL OR (tipo = 'video' AND duracao > 0)),
  -- sem data de captura o motor não tem como atribuir momento
  CHECK (capturada_em IS NOT NULL OR momento_id IS NULL)
) STRICT;

CREATE INDEX idx_fotos_retiro_capturada ON fotos (retiro_id, capturada_em);
CREATE INDEX idx_fotos_momento ON fotos (momento_id);
CREATE INDEX idx_fotos_equipe ON fotos (equipe_id);

CREATE TABLE livros (
  id        INTEGER PRIMARY KEY,
  titulo    TEXT    NOT NULL,
  autor     TEXT,
  descricao TEXT    NOT NULL,
  -- chave R2 da imagem de capa
  capa      TEXT    NOT NULL,
  ordem     INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE creditos (
  id        INTEGER PRIMARY KEY,
  retiro_id INTEGER NOT NULL REFERENCES retiros (id) ON DELETE CASCADE,
  nome      TEXT    NOT NULL,
  funcao    TEXT,
  ordem     INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE INDEX idx_creditos_retiro ON creditos (retiro_id);
