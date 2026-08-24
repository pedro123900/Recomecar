-- 0006 — Álbuns e curadoria (Bloco C).
--
-- Terceiro sistema de organização do acervo (CLAUDE.md, "Modelo de
-- organização"): coleções curadas FORA do tempo. Fotos entram por curadoria
-- no admin (seleção múltipla na grade), nunca no upload. Álbum não-exclusivo:
-- a foto aparece no tempo E no álbum. Álbum EXCLUSIVO: a foto sai de todas as
-- grades temporais públicas e existe só no álbum — momento_id/evento_id
-- permanecem gravados (dado é fato, exibição é escolha); a exclusão é
-- computada na consulta (NOT EXISTS em álbum exclusivo), nada é desnormalizado
-- em fotos, e remover a foto do álbum a devolve ao tempo sozinha.
--
-- Grupo como TEXT no álbum, não tabela própria (escolha desta migration, a
-- vetar na revisão): o contrato pede 1 nível ("Equipes" contém "Anjos"), e o
-- rótulo emergente dá isso com uma única ordem manual para a Holly cuidar —
-- a ordem dos álbuns; o grupo aparece na posição do seu primeiro álbum e
-- grupo vazio some por construção. Tabela própria exigiria segunda ordenação
-- e CRUD próprio sem ganho para 1 nível. Renomear grupo = UPDATE do rótulo
-- nos álbuns dele (ação do admin). Se o aninhamento um dia passar de 1 nível,
-- a promoção do grupo a tabela própria é a migração esperada.
--
-- Integridade entre retiros (álbum e foto do MESMO retiro) não tem como ser
-- FK no SQLite: garantida pela tela de curadoria, que só lista fotos do
-- próprio retiro. Formatos e convenções: os mesmos da 0001.

CREATE TABLE albuns (
  id        INTEGER PRIMARY KEY,
  retiro_id INTEGER NOT NULL REFERENCES retiros (id) ON DELETE CASCADE,
  nome      TEXT    NOT NULL COLLATE NOCASE,
  -- 1 nível de aninhamento; NULL = álbum solto (fora de qualquer grupo)
  grupo     TEXT,
  -- cor do coração Phosphor no site; seletor visual no admin grava '#rrggbb';
  -- NULL = coração na cor padrão. A forma óbvia (seis classes GLOB) estoura o
  -- limite de complexidade de padrão LIKE/GLOB do runtime do D1 na hora do
  -- INSERT ("pattern too complex") — daí a decomposição: 7 caracteres, '#' na
  -- frente e nenhum não-hexa no resto (verificada na sanidade de 21/08/2026)
  cor       TEXT             CHECK (cor IS NULL OR (length(cor) = 7
                             AND substr(cor, 1, 1) = '#'
                             AND NOT lower(substr(cor, 2)) GLOB '*[^0-9a-f]*')),
  -- ordem manual dos álbuns na seção pública (e do grupo, pelo primeiro deles)
  ordem     INTEGER NOT NULL DEFAULT 0,
  exclusivo INTEGER NOT NULL DEFAULT 0 CHECK (exclusivo IN (0, 1)),
  -- dois álbuns com o mesmo nome na mesma edição só confundiriam a curadoria.
  -- Limitação verificada na sanidade (21/08/2026): o NOCASE do SQLite dobra
  -- só ASCII — "Ágape" vs "ágape" passam pelo UNIQUE; a igualdade ignorando
  -- acento é validação do admin, como a do emoji no nome
  UNIQUE (retiro_id, nome)
) STRICT;

CREATE INDEX idx_albuns_retiro_ordem ON albuns (retiro_id, ordem);

CREATE TABLE album_fotos (
  album_id INTEGER NOT NULL REFERENCES albuns (id) ON DELETE CASCADE,
  foto_id  INTEGER NOT NULL REFERENCES fotos (id) ON DELETE CASCADE,
  -- ordem manual DENTRO do álbum — os destaques da capa são as primeiras
  -- 1–2 fotos do álbum "Instagramáveis" por esta ordem
  ordem    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, foto_id)
) STRICT;

-- consultas por foto: exclusividade (NOT EXISTS) e "em quais álbuns está"
CREATE INDEX idx_album_fotos_foto ON album_fotos (foto_id);
