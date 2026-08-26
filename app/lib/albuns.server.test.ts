import { describe, expect, test } from "vitest";
import {
  SQL_ALBUNS_COM_FOTOS,
  SQL_CONTAR_FOTOS_DO_ALBUM,
  SQL_FOTOS_DO_ALBUM,
  SQL_FOTO_DO_ALBUM,
} from "./albuns.server";

// Espelho deliberado de retiro-publico.test.ts: lá, TODA consulta temporal
// embute o fragmento de exclusão de álbum exclusivo; aqui, NENHUMA consulta
// embute — álbum é sobreposição curada, fora do tempo, e é exatamente nele
// que a foto de álbum exclusivo aparece. Se alguém "consertar" uma consulta
// destas colando o fragmento, o álbum exclusivo ficaria vazio no público.

describe("consulta curada não embute a exclusão de álbum exclusivo", () => {
  const consultas: Record<string, string> = {
    "álbuns com fotos (seção da capa e chips)": SQL_ALBUNS_COM_FOTOS,
    "fotos do álbum (grade ?album= e destaques)": SQL_FOTOS_DO_ALBUM,
    "contagem do álbum (paginação)": SQL_CONTAR_FOTOS_DO_ALBUM,
    "foto isolada do álbum (lightbox por URL)": SQL_FOTO_DO_ALBUM,
  };
  for (const [nome, sql] of Object.entries(consultas)) {
    test(nome, () => {
      expect(sql).not.toContain("NOT EXISTS");
    });
  }
});

describe("regras próprias das consultas curadas", () => {
  test("fotos do álbum saem na ordem manual da curadoria, não na cronológica", () => {
    expect(SQL_FOTOS_DO_ALBUM).toContain("ORDER BY af.ordem");
    expect(SQL_FOTOS_DO_ALBUM).not.toContain("capturada_em");
  });

  test("álbum vazio some do público (JOIN estrito, não LEFT JOIN)", () => {
    expect(SQL_ALBUNS_COM_FOTOS).toContain("JOIN album_fotos");
    expect(SQL_ALBUNS_COM_FOTOS).not.toContain("LEFT JOIN");
  });
});
