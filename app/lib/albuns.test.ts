import { describe, expect, test } from "vitest";
import {
  agruparAlbuns,
  ehInstagramaveis,
  normalizarNome,
  validarCor,
  validarNome,
} from "./albuns";

// Regras puras do CRUD de álbuns e da seção pública (Bloco C, "Modelo de
// organização do acervo", item 3). As camadas: o UNIQUE NOCASE do schema pega
// duplicata exata ASCII; acento, emoji e o vínculo dos destaques são daqui.

describe("normalizarNome", () => {
  test("remove acento e caixa", () => {
    expect(normalizarNome("Instagramáveis")).toBe("instagramaveis");
  });

  test("apara espaços das pontas", () => {
    expect(normalizarNome("  Ágape ")).toBe("agape");
  });
});

describe("validarNome", () => {
  test("aceita nome novo sem conflito", () => {
    expect(validarNome("Partilhas", ["Equipes", "Instagramáveis"])).toBeNull();
  });

  test("emoji no nome aponta o campo cor como o caminho certo", () => {
    const erro = validarNome("Partilhas ❤️", []);
    expect(erro).toContain("campo cor");
  });

  test("duplicata ignorando acento é rejeitada (camada que o NOCASE não cobre)", () => {
    const erro = validarNome("agápe", ["Ágape"]);
    expect(erro).toContain("já existe");
  });

  // triangulação: a igualdade ignora caixa além do acento
  test("duplicata ignorando caixa e acento juntas é rejeitada", () => {
    const erro = validarNome("EQUIPES", ["Equipes"]);
    expect(erro).toContain("já existe");
  });
});

describe("ehInstagramaveis", () => {
  test("reconhece o nome com acento e caixa livres", () => {
    expect(ehInstagramaveis("INSTAGRAMÁVEIS")).toBe(true);
  });

  test("reconhece o nome já normalizado", () => {
    expect(ehInstagramaveis("instagramaveis")).toBe(true);
  });

  test("qualquer outro álbum não é a fonte dos destaques", () => {
    expect(ehInstagramaveis("Partilhas")).toBe(false);
  });
});

describe("agruparAlbuns", () => {
  const a = (nome: string, grupo: string | null) => ({ nome, grupo });

  test("grupo aparece na posição do seu primeiro álbum e reúne os demais", () => {
    const grupos = agruparAlbuns([
      a("Anjos", "Equipes"),
      a("Instagramáveis", null),
      a("Cozinha", "Equipes"),
    ]);
    expect(grupos).toEqual([
      { grupo: "Equipes", albuns: [a("Anjos", "Equipes"), a("Cozinha", "Equipes")] },
      { grupo: null, albuns: [a("Instagramáveis", null)] },
    ]);
  });

  // triangulação: álbuns soltos não se fundem num bloco único — cada um
  // preserva a própria posição na ordem manual
  test("álbuns sem grupo ficam soltos, cada um na própria posição", () => {
    const grupos = agruparAlbuns([
      a("Instagramáveis", null),
      a("Anjos", "Equipes"),
      a("Partilhas", null),
    ]);
    expect(grupos).toEqual([
      { grupo: null, albuns: [a("Instagramáveis", null)] },
      { grupo: "Equipes", albuns: [a("Anjos", "Equipes")] },
      { grupo: null, albuns: [a("Partilhas", null)] },
    ]);
  });
});

describe("validarCor", () => {
  test("sem cor é válido (coração na cor padrão)", () => {
    expect(validarCor(null)).toBeNull();
  });

  test("aceita #rrggbb em qualquer caixa", () => {
    expect(validarCor("#A1b2C3")).toBeNull();
  });

  test("rejeita valor sem cerquilha", () => {
    expect(validarCor("a1b2c3")).not.toBeNull();
  });

  test("rejeita dígito fora do hexa", () => {
    expect(validarCor("#a1b2gg")).not.toBeNull();
  });

  // triangulação: comprimento errado também cai, mesmo sendo hexa válido
  test("rejeita forma curta #rgb", () => {
    expect(validarCor("#abc")).not.toBeNull();
  });
});
