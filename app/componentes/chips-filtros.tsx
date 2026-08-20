import { Link } from "react-router";

export interface Chip {
  rotulo: string;
  url: string; // URL com o filtro aplicado (ou removido, se ativo)
  ativo: boolean;
}

export interface GrupoDeChips {
  titulo: string;
  chips: Chip[];
}

// Chips de filtro combináveis: links GET que reescrevem a query — SSR,
// URL compartilhável, zero estado no cliente. Chip ativo é o link de remoção.
export function ChipsFiltros({ grupos }: { grupos: GrupoDeChips[] }) {
  const visiveis = grupos.filter((g) => g.chips.length > 0);
  if (visiveis.length === 0) return null;
  return (
    <nav aria-label="Filtros" className="mt-3 flex flex-col gap-1">
      {visiveis.map((grupo) => (
        <div key={grupo.titulo} className="flex items-baseline gap-2 overflow-x-auto">
          <span className="shrink-0 text-sm font-bold">{grupo.titulo}:</span>
          <ul className="flex list-none gap-2 p-0">
            {grupo.chips.map((chip) => (
              <li key={chip.rotulo} className="shrink-0">
                <Link
                  to={chip.url}
                  aria-pressed={chip.ativo}
                  className={
                    chip.ativo
                      ? "rounded-full border px-2 text-sm font-bold underline"
                      : "rounded-full border px-2 text-sm"
                  }
                >
                  {chip.ativo ? `${chip.rotulo} ✕` : chip.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
