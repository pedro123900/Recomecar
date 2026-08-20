import { describe, expect, test } from "vitest";
import { diaDaFoto, faixasDosDias } from "./faixas";

// Retiro de teste: pré 19/09 (sábado anterior), retiro 25–27/09/2099.
// Primeiros momentos: pré 09:00, sexta 18:00, sábado 08:00, domingo 08:00.
const DIAS = ["2099-09-19", "2099-09-25", "2099-09-26", "2099-09-27"];
const MOMENTOS = [
  { dia: "2099-09-19", inicio: "2099-09-19 09:00:00" },
  { dia: "2099-09-19", inicio: "2099-09-19 15:00:00" },
  { dia: "2099-09-25", inicio: "2099-09-25 18:00:00" },
  { dia: "2099-09-25", inicio: "2099-09-25 22:00:00" }, // vigília
  { dia: "2099-09-26", inicio: "2099-09-26 08:00:00" },
  { dia: "2099-09-27", inicio: "2099-09-27 08:00:00" },
];

const faixas = faixasDosDias(DIAS, MOMENTOS);

describe("faixasDosDias", () => {
  test("faixa de cada dia: da chegada (mesmo dia de calendário) ao primeiro momento do dia seguinte", () => {
    expect(faixas).toEqual([
      // pré: teto no fim do dia de calendário seguinte — não engole a semana
      { data: "2099-09-19", inicio: "2099-09-19 00:00:00", fim: "2099-09-21 00:00:00" },
      // sexta: começa na meia-noite do próprio dia (chegada/montagem) e vai
      // até o primeiro momento do sábado (madrugada da vigília é da sexta)
      { data: "2099-09-25", inicio: "2099-09-25 00:00:00", fim: "2099-09-26 08:00:00" },
      { data: "2099-09-26", inicio: "2099-09-26 08:00:00", fim: "2099-09-27 08:00:00" },
      // último dia: estende até o fim do dia de calendário seguinte
      { data: "2099-09-27", inicio: "2099-09-27 08:00:00", fim: "2099-09-29 00:00:00" },
    ]);
  });

  test("sem pré, o primeiro dia começa na meia-noite dele mesmo", () => {
    const f = faixasDosDias(DIAS.slice(1), MOMENTOS.slice(2));
    expect(f[0]).toEqual({
      data: "2099-09-25",
      inicio: "2099-09-25 00:00:00",
      fim: "2099-09-26 08:00:00",
    });
  });

  test("dia lógico sem nenhum momento usa a meia-noite como piso (cronograma incompleto)", () => {
    const f = faixasDosDias(
      ["2099-09-25", "2099-09-26"],
      [{ dia: "2099-09-25", inicio: "2099-09-25 18:00:00" }],
    );
    // a faixa da sexta termina onde o sábado (sem momentos) começa
    expect(f[0].fim).toBe("2099-09-26 00:00:00");
    expect(f[1]).toEqual({
      data: "2099-09-26",
      inicio: "2099-09-26 00:00:00",
      fim: "2099-09-28 00:00:00",
    });
  });

  test("lista vazia de dias devolve vazio", () => {
    expect(faixasDosDias([], [])).toEqual([]);
  });
});

describe("diaDaFoto", () => {
  test("madrugada pós-vigília pertence ao dia anterior", () => {
    expect(diaDaFoto(faixas, "2099-09-26 00:40:00")).toBe("2099-09-25");
  });

  test("chegada na sexta antes do primeiro momento pertence à sexta", () => {
    expect(diaDaFoto(faixas, "2099-09-25 15:00:00")).toBe("2099-09-25");
  });

  test("manhã seguinte ao pré (dentro do teto de calendário) pertence ao pré", () => {
    expect(diaDaFoto(faixas, "2099-09-20 10:00:00")).toBe("2099-09-19");
  });

  test("buraco da semana entre pré e sexta: sem dia (Geral sem dia)", () => {
    expect(diaDaFoto(faixas, "2099-09-22 15:00:00")).toBeNull();
  });

  test("manhã de desmontagem no dia seguinte ao último dia pertence ao último dia", () => {
    expect(diaDaFoto(faixas, "2099-09-28 10:00:00")).toBe("2099-09-27");
  });

  test("dois dias depois do fim: sem dia", () => {
    expect(diaDaFoto(faixas, "2099-09-29 10:00:00")).toBeNull();
  });

  test("muito antes do retiro: sem dia", () => {
    expect(diaDaFoto(faixas, "2099-09-10 12:00:00")).toBeNull();
  });

  test("sem data de captura: sem dia", () => {
    expect(diaDaFoto(faixas, null)).toBeNull();
  });
});
