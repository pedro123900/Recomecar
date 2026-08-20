import { describe, expect, test } from "vitest";
import {
  dataPorExtensoPtBr,
  itemGaleria,
  textoAlternativo,
  type LinhaFotoGaleria,
} from "./galeria";

describe("dataPorExtensoPtBr", () => {
  test("data do retiro por extenso com dia da semana", () => {
    // 25/09/2026 é a sexta-feira do 9 Recomeçar
    expect(dataPorExtensoPtBr("2026-09-25")).toBe(
      "sexta-feira, 25 de setembro de 2026",
    );
  });

  test("domingo e virada de mês", () => {
    expect(dataPorExtensoPtBr("2026-11-01")).toBe(
      "domingo, 1 de novembro de 2026",
    );
  });
});

describe("textoAlternativo", () => {
  test("foto com momento leva momento, dia lógico e título da edição", () => {
    expect(
      textoAlternativo({
        tipo: "foto",
        momentoNome: "Santa Missa",
        momentoDia: "2026-09-27",
        retiroTitulo: "9 Recomeçar",
      }),
    ).toBe(
      "Foto — Santa Missa, domingo, 27 de setembro de 2026, 9 Recomeçar",
    );
  });

  test("vídeo usa o prefixo Vídeo com o mesmo padrão", () => {
    expect(
      textoAlternativo({
        tipo: "video",
        momentoNome: "Luau",
        momentoDia: "2026-09-26",
        retiroTitulo: "9 Recomeçar",
      }),
    ).toBe("Vídeo — Luau, sábado, 26 de setembro de 2026, 9 Recomeçar");
  });

  test("sem momento vira Geral / Bastidores, sem dia lógico", () => {
    expect(
      textoAlternativo({
        tipo: "foto",
        momentoNome: null,
        momentoDia: null,
        retiroTitulo: "9 Recomeçar",
      }),
    ).toBe("Foto — Geral / Bastidores, 9 Recomeçar");
  });
});

function linha(sobrescrever: Partial<LinhaFotoGaleria> = {}): LinhaFotoGaleria {
  return {
    id: 7,
    arquivo_r2: "_teste/9-recomecar/originais/01ABC.jpg",
    tipo: "foto",
    largura: 4000,
    altura: 3000,
    duracao: null,
    momento_nome: "Santa Missa",
    momento_dia: "2026-09-27",
    ...sobrescrever,
  };
}

describe("itemGaleria", () => {
  test("foto: exibe a thumb derivada e baixa o original", () => {
    const item = itemGaleria(linha(), "9 Recomeçar", "");
    expect(item.urlExibicao).toBe(
      "/midia/_teste/9-recomecar/derivadas/01ABC/thumb",
    );
    expect(item.urlDownload).toBe(
      "/midia/_teste/9-recomecar/originais/01ABC.jpg",
    );
    expect(item.largura).toBe(4000);
    expect(item.altura).toBe(3000);
    expect(item.legenda).toBe("Santa Missa");
    expect(item.alt).toBe(
      "Foto — Santa Missa, domingo, 27 de setembro de 2026, 9 Recomeçar",
    );
  });

  test("vídeo: exibe o poster derivado", () => {
    const item = itemGaleria(
      linha({
        arquivo_r2: "_teste/9-recomecar/originais/01DEF.mp4",
        tipo: "video",
        duracao: 12.5,
      }),
      "9 Recomeçar",
      "",
    );
    expect(item.urlExibicao).toBe(
      "/midia/_teste/9-recomecar/derivadas/01DEF/poster",
    );
    expect(item.tipo).toBe("video");
  });

  test("sem momento a legenda é Geral / Bastidores", () => {
    const item = itemGaleria(
      linha({ momento_nome: null, momento_dia: null }),
      "9 Recomeçar",
      "",
    );
    expect(item.legenda).toBe("Geral / Bastidores");
    expect(item.alt).toBe("Foto — Geral / Bastidores, 9 Recomeçar");
  });

  test("base pública entra nas duas URLs", () => {
    const item = itemGaleria(linha(), "9 Recomeçar", "https://midia.exemplo.com");
    expect(item.urlExibicao).toBe(
      "https://midia.exemplo.com/_teste/9-recomecar/derivadas/01ABC/thumb",
    );
    expect(item.urlDownload).toBe(
      "https://midia.exemplo.com/_teste/9-recomecar/originais/01ABC.jpg",
    );
  });
});
