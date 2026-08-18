// Normaliza para o formato exigido pelo CHECK do banco: somente [0-9a-z-].
// "9 Recomeçar" => "9-recomecar" (NFD separa o acento; ç vira c).
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
