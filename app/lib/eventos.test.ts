import { describe, expect, test } from "vitest";
import {
  eventosEmDiasLogicos,
  normalizarHorario,
  validarHorarioNaData,
} from "./eventos";

// Dados 100% sintéticos (datas 2098/2099) — regra de privacidade do CLAUDE.md.

describe("normalizarHorario — input time HH:MM para o canônico HH:MM:SS", () => {
  test("HH:MM ganha os segundos", () => {
    expect(normalizarHorario("14:30")).toBe("14:30:00");
  });

  test("vazio vira null (horário é opcional)", () => {
    expect(normalizarHorario("")).toBeNull();
  });
});

describe("validarHorarioNaData — bloqueio: 2+ eventos na data exigem horários preenchidos e distintos", () => {
  test("sozinho na data, sem horário: válido", () => {
    expect(validarHorarioNaData(null, [])).toBeNull();
  });

  test("segundo evento sem horário na data: erro", () => {
    expect(validarHorarioNaData(null, [{ horario: "10:00:00" }])).toBe(
      "Com mais de um evento na mesma data, todos precisam de horário.",
    );
  });

  test("evento existente sem horário na data: erro (caso misto)", () => {
    expect(validarHorarioNaData("10:00:00", [{ horario: null }])).toBe(
      "Com mais de um evento na mesma data, todos precisam de horário.",
    );
  });

  test("horário duplicado na data: erro", () => {
    expect(validarHorarioNaData("10:00:00", [{ horario: "10:00:00" }])).toBe(
      "Já existe evento nesta data com este horário.",
    );
  });

  test("horários distintos na data: válido", () => {
    expect(
      validarHorarioNaData("11:00:00", [{ horario: "10:00:00" }]),
    ).toBeNull();
  });
});

describe("eventosEmDiasLogicos — aviso (não bloqueio) de colisão com o retiro", () => {
  const dias = ["2099-09-19", "2099-09-25", "2099-09-26", "2099-09-27"];

  test("evento em data de dia lógico aparece na lista de avisos", () => {
    const eventos = [
      { id: 1, data: "2099-08-23" },
      { id: 2, data: "2099-09-25" },
    ];
    expect(eventosEmDiasLogicos(eventos, dias)).toEqual([
      { id: 2, data: "2099-09-25" },
    ]);
  });

  test("evento fora dos dias lógicos não gera aviso", () => {
    expect(eventosEmDiasLogicos([{ id: 1, data: "2099-08-23" }], dias)).toEqual(
      [],
    );
  });
});
