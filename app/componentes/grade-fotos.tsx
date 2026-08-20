import { Link } from "react-router";
import type { ItemGaleria } from "~/lib/galeria";

// A grade única do site (fase crua: estrutura semântica, sem design).
// width/height reservam o aspect-ratio nativamente — zero layout shift.
// urlItem, quando presente, faz a mídia abrir o lightbox (?foto=id).
export function GradeFotos({
  itens,
  urlItem,
}: {
  itens: ItemGaleria[];
  urlItem?: (item: ItemGaleria) => string;
}) {
  return (
    <ul className="galeria mt-3 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 md:grid-cols-4">
      {itens.map((item) => {
        const img = (
          <img
            src={item.urlExibicao}
            alt={item.alt}
            width={item.largura}
            height={item.altura}
            loading="lazy"
            decoding="async"
            className="h-auto w-full"
          />
        );
        return (
          <li key={item.id} className="galeria-item">
            <figure>
              {urlItem ? (
                <Link to={urlItem(item)} preventScrollReset>
                  {img}
                </Link>
              ) : (
                img
              )}
              <figcaption className="text-sm">
                {item.tipo === "video" && <span aria-hidden="true">▶ </span>}
                {item.legenda} ·{" "}
                <a href={item.urlDownload} className="underline">
                  Baixar original
                </a>
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
