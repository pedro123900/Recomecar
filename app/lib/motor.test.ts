import { describe, expect, test } from "vitest";
import { diaDaFoto, faixasDosDias } from "./faixas";
import {
  atribuirEvento,
  atribuirMomento,
  atribuirTemporal,
  calcularRetag,
  ehGeral,
} from "./motor";

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

describe("pré-retiro — dia lógico adicional, uma semana antes", () => {
  // Momento do pré-retiro (data_pre), sábado anterior ao fim de semana do
  // retiro. Para o motor é uma janela como outra qualquer.
  const momentoDoPre = {
    id: 20,
    dia: "2099-09-19",
    inicio: "2099-09-19 14:00:00",
    fim: "2099-09-19 15:00:00",
  };

  test("foto no dia do pré cai no momento do pré", () => {
    expect(atribuirMomento("2099-09-19 14:30:00", [momentoDoPre])).toBe(20);
  });

  test("foto no intervalo vazio entre o pré e a sexta cai em Bastidores", () => {
    const sexta = {
      id: 21,
      inicio: "2099-09-25 18:00:00",
      fim: "2099-09-25 20:00:00",
    };
    // quarta-feira entre o pré (19/09) e o retiro (25-27/09)
    expect(
      atribuirMomento("2099-09-23 10:00:00", [momentoDoPre, sexta]),
    ).toBeNull();
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
    const fotos = [
      { id: 10, capturada_em: "2099-01-01 13:00:00", momento_id: 1, evento_id: null },
    ];
    expect(calcularRetag(fotos, [manha, tardeAmpliada], [])).toEqual([
      { fotoId: 10, momentoId: 2, eventoId: null },
    ]);
  });

  test("foto cujo momento não mudou NÃO aparece na lista", () => {
    const fotos = [
      { id: 11, capturada_em: "2099-01-01 10:00:00", momento_id: 1, evento_id: null },
    ];
    expect(calcularRetag(fotos, [manha, tarde], [])).toEqual([]);
  });

  test("janela editada cria buraco onde havia foto: aparece com momentoId null", () => {
    const fotos = [
      { id: 12, capturada_em: "2099-01-01 13:00:00", momento_id: 1, evento_id: null },
    ];
    expect(calcularRetag(fotos, [manha, tarde], [])).toEqual([
      { fotoId: 12, momentoId: null, eventoId: null },
    ]);
  });

  test("foto com capturada_em null que tinha momento aparece com null", () => {
    const fotos = [{ id: 13, capturada_em: null, momento_id: 1, evento_id: null }];
    expect(calcularRetag(fotos, [manha, tarde], [])).toEqual([
      { fotoId: 13, momentoId: null, eventoId: null },
    ]);
  });

  test("foto com capturada_em null e sem momento não aparece", () => {
    const fotos = [{ id: 14, capturada_em: null, momento_id: null, evento_id: null }];
    expect(calcularRetag(fotos, [manha, tarde], [])).toEqual([]);
  });
});

describe("re-tag entre sistemas — transição atômica (exigência 5)", () => {
  const janela = { id: 1, inicio: "2099-09-25 18:00:00", fim: "2099-09-25 20:00:00" };
  const evento = { id: 50, data: "2099-09-25", horario: null };

  test("cronograma cadastrado depois: momentoId setado e eventoId limpo na MESMA mudança", () => {
    // O CHECK de exclusividade do schema exige que a troca de sistema chegue
    // ao banco num único UPDATE — a mudança carrega as duas colunas juntas.
    const fotos = [
      { id: 20, capturada_em: "2099-09-25 19:00:00", momento_id: null, evento_id: 50 },
    ];
    expect(calcularRetag(fotos, [janela], [evento])).toEqual([
      { fotoId: 20, momentoId: 1, eventoId: null },
    ]);
  });

  test("janela editada deixa de cobrir a foto: volta ao evento da data na mesma mudança", () => {
    const fotos = [
      { id: 21, capturada_em: "2099-09-25 08:00:00", momento_id: 1, evento_id: null },
    ];
    expect(calcularRetag(fotos, [janela], [evento])).toEqual([
      { fotoId: 21, momentoId: null, eventoId: 50 },
    ]);
  });

  test("evento apagado: foto do evento volta a Geral", () => {
    const fotos = [
      { id: 22, capturada_em: "2099-09-25 08:00:00", momento_id: null, evento_id: 50 },
    ];
    expect(calcularRetag(fotos, [janela], [])).toEqual([
      { fotoId: 22, momentoId: null, eventoId: null },
    ]);
  });

  test("foto já no evento certo não aparece na lista", () => {
    const fotos = [
      { id: 23, capturada_em: "2099-09-25 08:00:00", momento_id: null, evento_id: 50 },
    ];
    expect(calcularRetag(fotos, [janela], [evento])).toEqual([]);
  });
});

describe("modo dia inteiro — eventos de Preparação (Bloco B)", () => {
  const acaoSocial = { id: 30, data: "2099-08-23", horario: null };

  test("foto com EXIF na data do evento entra sozinha no evento", () => {
    expect(atribuirEvento("2099-08-23 15:00:00", [acaoSocial])).toBe(30);
  });

  test("foto fora da data de qualquer evento => null", () => {
    expect(atribuirEvento("2099-08-24 15:00:00", [acaoSocial])).toBeNull();
  });

  test("capturada_em null => null (nunca inferir de mtime)", () => {
    expect(atribuirEvento(null, [acaoSocial])).toBeNull();
  });
});

describe("desempate encadeado — 2+ eventos na mesma data", () => {
  // arrays desordenados de propósito: o resultado não pode depender da ordem
  const manha = { id: 31, data: "2099-08-23", horario: "10:00:00" };
  const noite = { id: 32, data: "2099-08-23", horario: "18:00:00" };

  test("foto depois do último horário cai no último evento", () => {
    expect(atribuirEvento("2099-08-23 19:00:00", [manha, noite])).toBe(32);
  });

  test("foto entre os horários cai no anterior (último com horário <= captura)", () => {
    expect(atribuirEvento("2099-08-23 15:00:00", [noite, manha])).toBe(31);
  });

  test("foto exatamente no horário do evento pertence a ele", () => {
    expect(atribuirEvento("2099-08-23 18:00:00", [manha, noite])).toBe(32);
  });

  test("foto antes do primeiro horário cai no primeiro evento do dia", () => {
    expect(atribuirEvento("2099-08-23 08:00:00", [noite, manha])).toBe(31);
  });
});

describe("atribuirTemporal — precedência: momento vence, evento é fallback", () => {
  const janela = { id: 1, inicio: "2099-09-25 18:00:00", fim: "2099-09-25 20:00:00" };
  const eventoNaData = { id: 50, data: "2099-09-25", horario: null };

  test("janela cobrindo a foto: momento leva, mesmo com evento na mesma data", () => {
    expect(
      atribuirTemporal("2099-09-25 19:00:00", [janela], [eventoNaData]),
    ).toEqual({ momentoId: 1, eventoId: null });
  });

  test("sem janela cobrindo, o evento da data pega a foto", () => {
    expect(
      atribuirTemporal("2099-09-25 08:00:00", [janela], [eventoNaData]),
    ).toEqual({ momentoId: null, eventoId: 50 });
  });

  test("sem momento nem evento => Geral (ambos null)", () => {
    expect(atribuirTemporal("2099-09-25 08:00:00", [janela], [])).toEqual({
      momentoId: null,
      eventoId: null,
    });
  });
});

describe("colisão evento × dia lógico (exigência: os dois lados)", () => {
  // Cronograma sintético: retiro 25–26/09, primeira janela às 18:00 do dia 25.
  // A foto das 08:00 do dia 25 não casa janela nenhuma.
  const momentos = [
    { id: 1, dia: "2099-09-25", inicio: "2099-09-25 18:00:00", fim: "2099-09-25 20:00:00" },
    { id: 2, dia: "2099-09-26", inicio: "2099-09-26 09:00:00", fim: "2099-09-26 12:00:00" },
  ];
  const faixas = faixasDosDias(["2099-09-25", "2099-09-26"], momentos);
  const foto = "2099-09-25 08:00:00";

  test("COM evento na data: a foto vai ao evento e sai da herança de dia (não é Geral)", () => {
    const montagem = { id: 51, data: "2099-09-25", horario: null };
    const atrib = atribuirTemporal(foto, momentos, [montagem]);
    expect(atrib).toEqual({ momentoId: null, eventoId: 51 });
    // sistema temporal único: com evento a foto não é Geral, logo a herança
    // de dia por faixa (que só se aplica a Geral) não a alcança
    expect(ehGeral(atrib)).toBe(false);
  });

  test("SEM evento na data: a mesma foto é Geral e herda o dia pela faixa", () => {
    const atrib = atribuirTemporal(foto, momentos, []);
    expect(atrib).toEqual({ momentoId: null, eventoId: null });
    expect(ehGeral(atrib)).toBe(true);
    expect(diaDaFoto(faixas, foto)).toBe("2099-09-25");
  });
});
