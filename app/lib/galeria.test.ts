import { describe, expect, test } from "vitest";
import {
  amostraEstavel,
  analisarFiltros,
  blocosLinhaDoTempo,
  condicoesGrade,
  dataPorExtensoPtBr,
  diasDoRetiro,
  itemGaleria,
  paginar,
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

  test("sem momento vira Geral, sem dia lógico", () => {
    expect(
      textoAlternativo({
        tipo: "foto",
        momentoNome: null,
        momentoDia: null,
        retiroTitulo: "9 Recomeçar",
      }),
    ).toBe("Foto — Geral, 9 Recomeçar");
  });

  test("foto de evento de Preparação leva nome do evento e data", () => {
    expect(
      textoAlternativo({
        tipo: "foto",
        momentoNome: null,
        momentoDia: null,
        eventoNome: "Adoração",
        eventoData: "2098-08-07",
        retiroTitulo: "9 Recomeçar",
      }),
    ).toBe("Foto — Adoração, quinta-feira, 7 de agosto de 2098, 9 Recomeçar");
  });

  test("momento vence o evento no alt (sistema temporal único: nunca há os dois)", () => {
    expect(
      textoAlternativo({
        tipo: "foto",
        momentoNome: "Santa Missa",
        momentoDia: "2026-09-27",
        eventoNome: "Adoração",
        eventoData: "2098-08-07",
        retiroTitulo: "9 Recomeçar",
      }),
    ).toBe("Foto — Santa Missa, domingo, 27 de setembro de 2026, 9 Recomeçar");
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
    evento_nome: null,
    evento_data: null,
    ...sobrescrever,
  };
}

describe("itemGaleria", () => {
  test("foto: exibe a thumb derivada e baixa o original", () => {
    const item = itemGaleria(linha(), "9 Recomeçar", "");
    expect(item.urlExibicao).toBe(
      "/midia/_teste/9-recomecar/derivadas/01ABC/thumb",
    );
    // lightbox: foto amplia para a média 1600
    expect(item.urlAmpliada).toBe(
      "/midia/_teste/9-recomecar/derivadas/01ABC/media",
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
    // lightbox: vídeo não tem média — o player toca o original
    expect(item.urlAmpliada).toBe(
      "/midia/_teste/9-recomecar/originais/01DEF.mp4",
    );
  });

  test("sem momento a legenda é Geral", () => {
    const item = itemGaleria(
      linha({ momento_nome: null, momento_dia: null }),
      "9 Recomeçar",
      "",
    );
    expect(item.legenda).toBe("Geral");
    expect(item.alt).toBe("Foto — Geral, 9 Recomeçar");
  });

  test("foto de evento: legenda e alt vêm do evento", () => {
    const item = itemGaleria(
      linha({
        momento_nome: null,
        momento_dia: null,
        evento_nome: "Ação social",
        evento_data: "2098-08-23",
      }),
      "9 Recomeçar",
      "",
    );
    expect(item.legenda).toBe("Ação social");
    expect(item.alt).toBe(
      "Foto — Ação social, sábado, 23 de agosto de 2098, 9 Recomeçar",
    );
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

describe("amostraEstavel", () => {
  const itens = Array.from({ length: 20 }, (_, i) => i + 1);

  test("mesma semente devolve sempre a mesma amostra", () => {
    const a = amostraEstavel(itens, 3, "9-recomecar:7");
    const b = amostraEstavel(itens, 3, "9-recomecar:7");
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
  });

  test("amostra preserva a ordem original dos itens", () => {
    const a = amostraEstavel(itens, 5, "semente");
    expect([...a].sort((x, y) => x - y)).toEqual(a);
  });

  test("sementes diferentes dão amostras diferentes", () => {
    const a = amostraEstavel(itens, 3, "9-recomecar:7");
    const b = amostraEstavel(itens, 3, "9-recomecar:8");
    expect(a).not.toEqual(b);
  });

  test("n maior que a lista devolve a lista inteira", () => {
    expect(amostraEstavel([1, 2], 5, "s")).toEqual([1, 2]);
  });

  test("lista vazia devolve vazio", () => {
    expect(amostraEstavel([], 3, "s")).toEqual([]);
  });
});

const RETIRO_DIAS = {
  data_pre: "2099-09-19",
  data_dia1: "2099-09-25",
  data_dia2: "2099-09-26",
  data_dia3: "2099-09-27",
};

describe("diasDoRetiro", () => {
  test("com pré: quatro dias com ordinal, data e rótulo", () => {
    expect(diasDoRetiro(RETIRO_DIAS)).toEqual([
      { ordinal: "pre", data: "2099-09-19", rotulo: "Pré-retiro" },
      { ordinal: "dia-1", data: "2099-09-25", rotulo: "Dia 1" },
      { ordinal: "dia-2", data: "2099-09-26", rotulo: "Dia 2" },
      { ordinal: "dia-3", data: "2099-09-27", rotulo: "Dia 3" },
    ]);
  });

  test("sem pré: três dias", () => {
    const dias = diasDoRetiro({ ...RETIRO_DIAS, data_pre: null });
    expect(dias.map((d) => d.ordinal)).toEqual(["dia-1", "dia-2", "dia-3"]);
  });
});

describe("analisarFiltros", () => {
  const dias = diasDoRetiro(RETIRO_DIAS);

  test("valores válidos passam normalizados", () => {
    expect(
      analisarFiltros({ dia: "dia-2", momento: "14", musica: "Aleluia" }, dias),
    ).toEqual({ dia: "dia-2", momento: 14, musica: "Aleluia" });
  });

  test("momento geral é o valor especial", () => {
    expect(analisarFiltros({ momento: "geral" }, dias)).toEqual({
      momento: "geral",
    });
  });

  test("valores inválidos são descartados em silêncio", () => {
    expect(
      analisarFiltros({ dia: "dia-9", momento: "abc", musica: "" }, dias),
    ).toEqual({});
  });

  test("pre é ordinal válido só quando o retiro tem pré", () => {
    expect(analisarFiltros({ dia: "pre" }, dias)).toEqual({ dia: "pre" });
    const semPre = diasDoRetiro({ ...RETIRO_DIAS, data_pre: null });
    expect(analisarFiltros({ dia: "pre" }, semPre)).toEqual({});
  });

  test("evento válido passa normalizado", () => {
    expect(analisarFiltros({ evento: "51" }, dias)).toEqual({ evento: 51 });
  });

  test("evento é excludente: descarta dia, momento e música", () => {
    expect(
      analisarFiltros(
        { evento: "51", dia: "dia-2", momento: "14", musica: "Aleluia" },
        dias,
      ),
    ).toEqual({ evento: 51 });
  });

  test("evento inválido é descartado em silêncio (demais filtros valem)", () => {
    expect(analisarFiltros({ evento: "abc", dia: "dia-2" }, dias)).toEqual({
      dia: "dia-2",
    });
  });

  test("album válido passa normalizado", () => {
    expect(analisarFiltros({ album: "7" }, dias)).toEqual({ album: 7 });
  });

  test("album é excludente: descarta os filtros temporais e o evento", () => {
    expect(
      analisarFiltros(
        {
          album: "7",
          evento: "51",
          dia: "dia-2",
          momento: "14",
          musica: "Aleluia",
        },
        dias,
      ),
    ).toEqual({ album: 7 });
  });

  test("album inválido é descartado em silêncio (demais filtros valem)", () => {
    expect(analisarFiltros({ album: "0", evento: "51" }, dias)).toEqual({
      evento: 51,
    });
  });
});

describe("condicoesGrade", () => {
  const dias = diasDoRetiro(RETIRO_DIAS);
  const faixas = [
    { data: "2099-09-25", inicio: "2099-09-25 00:00:00", fim: "2099-09-26 08:00:00" },
  ];

  test("sem filtros: fragmento vazio", () => {
    expect(condicoesGrade({}, faixas, dias)).toEqual({ sql: "", binds: [] });
  });

  test("dia filtra momentos do dia OU fotos Geral na faixa herdada (foto de evento fica fora)", () => {
    expect(condicoesGrade({ dia: "dia-1" }, faixas, dias)).toEqual({
      sql: "(m.dia = ? OR (f.momento_id IS NULL AND f.evento_id IS NULL AND f.capturada_em >= ? AND f.capturada_em < ?))",
      binds: ["2099-09-25", "2099-09-25 00:00:00", "2099-09-26 08:00:00"],
    });
  });

  test("dia sem faixa correspondente filtra só pelos momentos do dia", () => {
    expect(condicoesGrade({ dia: "dia-2" }, faixas, dias)).toEqual({
      sql: "m.dia = ?",
      binds: ["2099-09-26"],
    });
  });

  test("momento geral filtra fora dos DOIS sistemas (foto de evento não é Geral)", () => {
    expect(condicoesGrade({ momento: "geral" }, faixas, dias)).toEqual({
      sql: "f.momento_id IS NULL AND f.evento_id IS NULL",
      binds: [],
    });
  });

  test("filtro de evento filtra evento_id", () => {
    expect(condicoesGrade({ evento: 51 }, faixas, dias)).toEqual({
      sql: "f.evento_id = ?",
      binds: [51],
    });
  });

  test("filtros combinam com AND", () => {
    expect(
      condicoesGrade({ momento: 14, musica: "Aleluia" }, faixas, dias),
    ).toEqual({
      sql: "f.momento_id = ? AND m.musica = ?",
      binds: [14, "Aleluia"],
    });
  });
});

describe("paginar", () => {
  test("primeira página por padrão", () => {
    expect(paginar(300, undefined)).toEqual({ pagina: 1, paginas: 3, offset: 0 });
  });

  test("página do meio", () => {
    expect(paginar(300, "2")).toEqual({ pagina: 2, paginas: 3, offset: 120 });
  });

  test("página fora do intervalo é grampeada", () => {
    expect(paginar(300, "99").pagina).toBe(3);
    expect(paginar(300, "0").pagina).toBe(1);
    expect(paginar(300, "lixo").pagina).toBe(1);
  });

  test("acervo vazio tem uma página vazia", () => {
    expect(paginar(0, undefined)).toEqual({ pagina: 1, paginas: 1, offset: 0 });
  });
});

describe("blocosLinhaDoTempo", () => {
  const momentos = [
    { id: 2, nome: "Vigília", dia: "2099-09-25", inicio: "2099-09-25 22:00:00", musica: null },
    { id: 1, nome: "Abertura", dia: "2099-09-25", inicio: "2099-09-25 18:00:00", musica: "Aleluia" },
    { id: 3, nome: "Missa", dia: "2099-09-26", inicio: "2099-09-26 08:00:00", musica: null },
  ];

  test("blocos em ordem cronológica, só momentos com fotos", () => {
    const blocos = blocosLinhaDoTempo(momentos, { 1: 5, 2: 0, 3: 2 });
    expect(blocos.map((b) => b.nome)).toEqual(["Abertura", "Missa"]);
    expect(blocos[0]).toEqual({
      momentoId: 1,
      nome: "Abertura",
      dia: "2099-09-25",
      musica: "Aleluia",
      total: 5,
    });
  });

  test("momento sem contagem registrada conta como zero", () => {
    expect(blocosLinhaDoTempo(momentos, {})).toEqual([]);
  });
});
