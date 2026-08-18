import { describe, expect, test } from "vitest";
import { atribuirMomento, calcularRetag } from "./motor";

// Dados 100% sintéticos (datas 2099, nomes fictícios) — regra de privacidade
// do CLAUDE.md: nenhum conteúdo real de cronograma em arquivo versionado.

const momentoA = { id: 1, inicio: "2099-01-01 20:00:00", fim: "2099-01-01 21:00:00" };

describe("janela semiaberta (inicio <= t < fim)", () => {
  test("foto exatamente no inicio pertence ao momento", () => {
    expect(atribuirMomento("2099-01-01 20:00:00", [momentoA])).toBe(1);
  });

  test("foto exatamente no fim NÃO pertence ao momento", () => {
    expect(atribuirMomento("2099-01-01 21:00:00", [momentoA])).toBeNull();
  });

  test("foto no interior da janela pertence ao momento", () => {
    expect(atribuirMomento("2099-01-01 20:30:00", [momentoA])).toBe(1);
  });

  test("momentos contíguos (costura do encadeamento): foto no instante da costura pertence ao seguinte", () => {
    const momentoB = { id: 2, inicio: "2099-01-01 21:00:00", fim: "2099-01-01 22:00:00" };
    expect(atribuirMomento("2099-01-01 21:00:00", [momentoA, momentoB])).toBe(2);
  });

  test("momentos contíguos: foto um segundo antes da costura pertence ao anterior", () => {
    const momentoB = { id: 2, inicio: "2099-01-01 21:00:00", fim: "2099-01-01 22:00:00" };
    expect(atribuirMomento("2099-01-01 20:59:59", [momentoA, momentoB])).toBe(1);
  });

  test("foto em buraco entre momentos vai para Bastidores (null)", () => {
    const momentoC = { id: 3, inicio: "2099-01-01 22:00:00", fim: "2099-01-01 23:00:00" };
    expect(atribuirMomento("2099-01-01 21:30:00", [momentoA, momentoC])).toBeNull();
  });

  test("foto antes do primeiro momento => null", () => {
    expect(atribuirMomento("2099-01-01 19:00:00", [momentoA])).toBeNull();
  });

  test("foto depois do último fim => null", () => {
    expect(atribuirMomento("2099-01-01 23:59:00", [momentoA])).toBeNull();
  });
});

describe("Bastidores", () => {
  test("capturada_em null => null (nunca inferir de mtime)", () => {
    expect(atribuirMomento(null, [momentoA])).toBeNull();
  });

  test("retiro sem momentos cadastrados => null", () => {
    expect(atribuirMomento("2099-01-01 20:30:00", [])).toBeNull();
  });
});

describe("virada da meia-noite e dia lógico", () => {
  // Momento que cruza a meia-noite: pertence ao dia lógico 2099-01-01
  // mesmo com fim em 2099-01-02 no calendário.
  const vigilia = {
    id: 5,
    dia: "2099-01-01",
    inicio: "2099-01-01 23:30:00",
    fim: "2099-01-02 01:30:00",
  };

  test("foto antes da meia-noite pertence ao momento que cruza o dia", () => {
    expect(atribuirMomento("2099-01-01 23:45:00", [vigilia])).toBe(5);
  });

  test("foto depois da meia-noite (dia seguinte no calendário) pertence ao mesmo momento", () => {
    expect(atribuirMomento("2099-01-02 00:15:00", [vigilia])).toBe(5);
  });

  test("o agrupamento por dia vem de momento.dia, nunca de date(capturada_em)", () => {
    const id = atribuirMomento("2099-01-02 00:15:00", [vigilia]);
    expect(id).toBe(5);
    // A foto é de 02/01 no calendário, mas o vínculo carrega o dia lógico 01/01.
    expect(vigilia.dia).toBe("2099-01-01");
    expect(vigilia.dia).not.toBe("2099-01-02");
  });
});

describe("sobreposição — comportamento PROVISÓRIO registrado como está", () => {
  // ATENÇÃO: "menor inicio ganha" NÃO é decisão tomada. É o comportamento
  // provisório desta fase, registrado para ser determinístico. O desempate
  // definitivo será definido na fase seguinte do motor, e a direção provável
  // é a INVERSA: a janela mais específica (mais curta) ganhar.
  test("janela longa contendo janela curta: hoje devolve a LONGA (menor inicio)", () => {
    const equipe = { id: 2, inicio: "2099-01-01 15:20:00", fim: "2099-01-01 17:00:00" };
    const atividade = { id: 3, inicio: "2099-01-01 15:40:00", fim: "2099-01-01 16:00:00" };
    // curta primeiro no array de propósito: o resultado não pode depender da ordem
    expect(atribuirMomento("2099-01-01 15:45:00", [atividade, equipe])).toBe(2);
  });

  test("trilhas paralelas com o MESMO inicio: hoje devolve o de menor id", () => {
    const trilhaX = { id: 9, inicio: "2099-01-01 15:20:00", fim: "2099-01-01 16:00:00" };
    const trilhaY = { id: 4, inicio: "2099-01-01 15:20:00", fim: "2099-01-01 17:00:00" };
    expect(atribuirMomento("2099-01-01 15:30:00", [trilhaX, trilhaY])).toBe(4);
  });

  test("entrada desordenada dá o mesmo resultado (determinismo não depende do chamador)", () => {
    const cedo = { id: 7, inicio: "2099-01-01 10:00:00", fim: "2099-01-01 11:00:00" };
    const tarde = { id: 6, inicio: "2099-01-01 11:00:00", fim: "2099-01-01 12:00:00" };
    expect(atribuirMomento("2099-01-01 10:30:00", [tarde, cedo])).toBe(7);
    expect(atribuirMomento("2099-01-01 10:30:00", [cedo, tarde])).toBe(7);
  });
});

describe("calcularRetag — só as mudanças, para batch mínimo", () => {
  const manha = { id: 1, inicio: "2099-01-01 09:00:00", fim: "2099-01-01 12:00:00" };
  const tarde = { id: 2, inicio: "2099-01-01 14:00:00", fim: "2099-01-01 18:00:00" };

  test("janela editada: foto que caía em X e agora cai em Y aparece com o novo id", () => {
    // A foto de 13:00 estava em manha (id 1) quando a janela ia até 13:30;
    // com a janela editada (fim 12:00), ela agora cai em tardeAmpliada.
    const tardeAmpliada = { id: 2, inicio: "2099-01-01 12:30:00", fim: "2099-01-01 18:00:00" };
    const fotos = [{ id: 10, capturada_em: "2099-01-01 13:00:00", momento_id: 1 }];
    expect(calcularRetag(fotos, [manha, tardeAmpliada])).toEqual([
      { fotoId: 10, momentoId: 2 },
    ]);
  });

  test("foto cujo momento não mudou NÃO aparece na lista", () => {
    const fotos = [{ id: 11, capturada_em: "2099-01-01 10:00:00", momento_id: 1 }];
    expect(calcularRetag(fotos, [manha, tarde])).toEqual([]);
  });

  test("janela editada cria buraco onde havia foto: aparece com momentoId null", () => {
    const fotos = [{ id: 12, capturada_em: "2099-01-01 13:00:00", momento_id: 1 }];
    expect(calcularRetag(fotos, [manha, tarde])).toEqual([
      { fotoId: 12, momentoId: null },
    ]);
  });

  test("foto com capturada_em null que tinha momento aparece com null", () => {
    const fotos = [{ id: 13, capturada_em: null, momento_id: 1 }];
    expect(calcularRetag(fotos, [manha, tarde])).toEqual([
      { fotoId: 13, momentoId: null },
    ]);
  });

  test("foto com capturada_em null e sem momento não aparece", () => {
    const fotos = [{ id: 14, capturada_em: null, momento_id: null }];
    expect(calcularRetag(fotos, [manha, tarde])).toEqual([]);
  });
});
