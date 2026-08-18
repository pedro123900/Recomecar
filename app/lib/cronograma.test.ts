import { describe, expect, test } from "vitest";
import { listarDiasLogicos, momentosForaDosDias } from "./cronograma";

// Dados 100% sintéticos (datas 2099) — regra de privacidade do CLAUDE.md.

describe("listarDiasLogicos — datas explícitas, nenhuma inferência de intervalo", () => {
  test("com data_pre: pré + os três dias, na ordem dos campos", () => {
    const retiro = {
      data_pre: "2099-09-19",
      data_dia1: "2099-09-25",
      data_dia2: "2099-09-26",
      data_dia3: "2099-09-27",
    };
    expect(listarDiasLogicos(retiro)).toEqual([
      "2099-09-19",
      "2099-09-25",
      "2099-09-26",
      "2099-09-27",
    ]);
  });

  test("sem data_pre: só os três dias", () => {
    const retiro = {
      data_pre: null,
      data_dia1: "2099-09-25",
      data_dia2: "2099-09-26",
      data_dia3: "2099-09-27",
    };
    expect(listarDiasLogicos(retiro)).toEqual([
      "2099-09-25",
      "2099-09-26",
      "2099-09-27",
    ]);
  });

  test("datas não consecutivas são listadas como estão — nada é expandido nem preenchido", () => {
    const retiro = {
      data_pre: null,
      data_dia1: "2099-09-25",
      data_dia2: "2099-09-27",
      data_dia3: "2099-09-30",
    };
    expect(listarDiasLogicos(retiro)).toEqual([
      "2099-09-25",
      "2099-09-27",
      "2099-09-30",
    ]);
  });
});

describe("momentosForaDosDias — datas do retiro editadas com cronograma existente", () => {
  test("momento cujo dia lógico saiu do conjunto de dias é apontado (avisar, não bloquear)", () => {
    const momentos = [
      { id: 1, nome: "Momento A", dia: "2099-09-19" },
      { id: 2, nome: "Momento B", dia: "2099-09-25" },
    ];
    // retiro editado: pré removido => 2099-09-19 não é mais dia lógico
    const dias = ["2099-09-25", "2099-09-26", "2099-09-27"];
    expect(momentosForaDosDias(momentos, dias)).toEqual([
      { id: 1, nome: "Momento A", dia: "2099-09-19" },
    ]);
  });

  test("todos dentro => lista vazia", () => {
    const momentos = [{ id: 2, nome: "Momento B", dia: "2099-09-25" }];
    const dias = ["2099-09-25", "2099-09-26"];
    expect(momentosForaDosDias(momentos, dias)).toEqual([]);
  });
});
