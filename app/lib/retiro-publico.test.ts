import { describe, expect, test } from "vitest";
import {
  DE_FOTOS,
  SEM_ALBUM_EXCLUSIVO,
  SQL_EVENTOS_COM_FOTOS,
  SQL_IDS_POR_EVENTO,
  SQL_IDS_POR_MOMENTO,
  SQL_MOMENTOS_COM_FOTOS,
  SQL_MOMENTOS_DO_DIA,
  SQL_MUSICAS_COM_FOTOS,
  SQL_TEM_GERAL,
} from "./retiro-publico.server";

// Exclusividade (Bloco C): foto em álbum exclusivo sai de TODAS as grades
// temporais públicas e existe só no álbum. A garantia estrutural é um único
// fragmento de exclusão embutido em cada consulta temporal deste módulo —
// estes testes provam a presença do fragmento em cada uma; o comportamento
// do SQL em si (some da grade; removida do álbum, reaparece) é provado na
// sanidade contra o banco local com as mesmas consultas.

describe("fragmento de exclusão", () => {
  test("é o NOT EXISTS sobre vínculo em álbum exclusivo da foto corrente", () => {
    expect(SEM_ALBUM_EXCLUSIVO).toContain("NOT EXISTS");
    expect(SEM_ALBUM_EXCLUSIVO).toContain("a.exclusivo = 1");
    expect(SEM_ALBUM_EXCLUSIVO).toContain("af.foto_id = f.id");
  });
});

describe("toda consulta temporal pública embute a exclusão", () => {
  const consultas: Record<string, string> = {
    "grade única e contagens (DE_FOTOS)": DE_FOTOS,
    "ids por momento (capa e linha do tempo)": SQL_IDS_POR_MOMENTO,
    "ids por evento (amostras da Preparação)": SQL_IDS_POR_EVENTO,
    "eventos com fotos (seção Preparação e chips)": SQL_EVENTOS_COM_FOTOS,
    "momentos com fotos (chips)": SQL_MOMENTOS_COM_FOTOS,
    "existe foto Geral (chip Geral)": SQL_TEM_GERAL,
    "músicas com fotos (chips)": SQL_MUSICAS_COM_FOTOS,
    "momentos do dia com fotos (pastas do dia)": SQL_MOMENTOS_DO_DIA,
  };
  for (const [nome, sql] of Object.entries(consultas)) {
    test(nome, () => {
      expect(sql).toContain(SEM_ALBUM_EXCLUSIVO);
    });
  }
});
