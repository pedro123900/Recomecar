-- 0003 — Dias lógicos como datas explícitas; pré-retiro entra no modelo.
--
-- O pré-retiro (dia inteiro de programação no sábado anterior ao fim de
-- semana do retiro) é um dia lógico a mais do mesmo retiro: momentos normais
-- no construtor (aba "Pré-retiro"), tags normais no motor, nada a distinguir
-- no upload. O buraco de ~uma semana entre o pré e a sexta é normal: fotos
-- nesse intervalo caem em "Geral / Bastidores".
--
-- data_inicio/data_fim saem; entram datas EXPLÍCITAS, uma por dia lógico:
-- data_pre (opcional) + data_dia1..data_dia3 (obrigatórias). Nenhuma
-- inferência de intervalo: a Holly futura vê e edita cada dia por si.
-- "Pré opcional + 3 dias" é estrutura do schema — edição com outro número
-- de dias exigiria nova migration.
--
-- Por que recriar a tabela em vez de ALTER: o CHECK de tabela
-- (data_inicio <= data_fim) referencia as colunas, e o SQLite não derruba
-- coluna citada em constraint de tabela — DROP COLUMN falharia. As FKs de
-- momentos/fotos/creditos apontam para "retiros" pelo nome, restaurado pelo
-- RENAME ao final. Formato de data e comparação: os mesmos da 0001.

CREATE TABLE retiros_novo (
  id                  INTEGER PRIMARY KEY,
  serie               TEXT    NOT NULL CHECK (serie IN ('Recomeçar', 'Renascer')),
  numero              INTEGER NOT NULL CHECK (numero >= 1),
  -- slug entra em URL e em chave R2: somente [0-9a-z-]
  slug                TEXT    NOT NULL UNIQUE
                              CHECK (slug <> '' AND slug NOT GLOB '*[^0-9a-z-]*'),
  titulo              TEXT    NOT NULL,
  -- dias lógicos explícitos; NULL = edição sem pré-retiro
  data_pre            TEXT             CHECK (data_pre IS NULL OR date(data_pre) IS data_pre),
  data_dia1           TEXT    NOT NULL CHECK (date(data_dia1) IS data_dia1),
  data_dia2           TEXT    NOT NULL CHECK (date(data_dia2) IS data_dia2),
  data_dia3           TEXT    NOT NULL CHECK (date(data_dia3) IS data_dia3),
  padroeiro_nome      TEXT,
  padroeiro_invocacao TEXT,
  -- preenchido e sem mídia no acervo => card abre o Drive externo (nova aba)
  link_drive          TEXT,
  -- JSON com as cores da edição; NULL => tema padrão
  tema                TEXT             CHECK (tema IS NULL OR json_valid(tema)),
  publicado           INTEGER NOT NULL DEFAULT 0 CHECK (publicado IN (0, 1)),
  UNIQUE (serie, numero),
  CHECK (data_pre IS NULL OR data_pre < data_dia1),
  CHECK (data_dia1 < data_dia2),
  CHECK (data_dia2 < data_dia3)
) STRICT;

-- retiros está vazia (local e remoto); a cópia existe como rede de segurança
-- com mapeamento fiel para retiro de 3 dias (dia2 = dia1 + 1). Se algum dia
-- houver linha que não caiba nos CHECKs novos, a migration falha alto em vez
-- de corromper em silêncio.
INSERT INTO retiros_novo (id, serie, numero, slug, titulo, data_pre,
                          data_dia1, data_dia2, data_dia3, padroeiro_nome,
                          padroeiro_invocacao, link_drive, tema, publicado)
SELECT id, serie, numero, slug, titulo, NULL,
       data_inicio, date(data_inicio, '+1 day'), data_fim, padroeiro_nome,
       padroeiro_invocacao, link_drive, tema, publicado
FROM retiros;

DROP TABLE retiros;

ALTER TABLE retiros_novo RENAME TO retiros;
