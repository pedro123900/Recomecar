// Regras puras dos álbuns (Bloco C, "Modelo de organização do acervo",
// item 3). Camadas de validação: o UNIQUE NOCASE do schema pega duplicata
// exata ASCII; a igualdade ignorando acento, o emoji no nome e o vínculo do
// álbum de destaques ("Instagramáveis", match por nome — decisão do gate de
// 26/08/2026) vivem aqui, chamadas pelo admin e pela capa.

// Mesma normalização do slugify: NFD separa o acento, que é descartado.
export function normalizarNome(nome: string): string {
  return nome
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Emoji é proibido na interface (CLAUDE.md): quem digita ❤️ no nome está
// procurando o campo cor — a mensagem aponta o caminho, não só nega.
export function validarNome(
  nome: string,
  outrosNomes: string[],
): string | null {
  if (/\p{Extended_Pictographic}/u.test(nome)) {
    return "Emoji não entra no nome: use o campo cor para pintar o coração do álbum.";
  }
  const normalizado = normalizarNome(nome);
  if (outrosNomes.some((outro) => normalizarNome(outro) === normalizado)) {
    return "Um álbum com este nome já existe nesta edição (a comparação ignora acentos e maiúsculas).";
  }
  return null;
}

// O álbum que alimenta os destaques da capa é identificado pelo nome
// normalizado; renomeá-lo desfaz o vínculo em silêncio e a capa volta ao
// fallback (amostra estável) — por isso a dica fixa na tela do admin.
export function ehInstagramaveis(nome: string): boolean {
  return normalizarNome(nome) === "instagramaveis";
}

// Mesma regra do CHECK da 0006 — defesa da action com mensagem amigável
// (o seletor visual só gera valores válidos; isto pega URL/form adulterado).
export function validarCor(cor: string | null): string | null {
  if (cor === null) return null;
  return /^#[0-9a-f]{6}$/i.test(cor)
    ? null
    : "Cor inválida: escolha um coração da paleta.";
}

// Seção pública: uma única ordem manual (a dos álbuns); o grupo aparece na
// posição do seu primeiro álbum e reúne os demais; álbum sem grupo fica
// solto na própria posição (decisão registrada na migration 0006).
export function agruparAlbuns<T extends { grupo: string | null }>(
  albuns: T[],
): { grupo: string | null; albuns: T[] }[] {
  const grupos: { grupo: string | null; albuns: T[] }[] = [];
  const porRotulo = new Map<string, T[]>();
  for (const album of albuns) {
    if (album.grupo === null) {
      grupos.push({ grupo: null, albuns: [album] });
      continue;
    }
    const existente = porRotulo.get(album.grupo);
    if (existente) {
      existente.push(album);
    } else {
      const lista = [album];
      porRotulo.set(album.grupo, lista);
      grupos.push({ grupo: album.grupo, albuns: lista });
    }
  }
  return grupos;
}
