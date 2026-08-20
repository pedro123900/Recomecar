import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import type { ItemGaleria } from "~/lib/galeria";

// Lightbox da grade (?foto=<id>): média 1600 para fotos, player para vídeos,
// download do original. Navegação por botões, setas do teclado e swipe;
// Esc fecha. URLs de anterior/próximo preservam os filtros da grade.
export function Lightbox({
  item,
  urlFechar,
  urlAnterior,
  urlProxima,
}: {
  item: ItemGaleria;
  urlFechar: string;
  urlAnterior: string | null;
  urlProxima: string | null;
}) {
  const navigate = useNavigate();
  const toqueX = useRef<number | null>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate(urlFechar, { preventScrollReset: true });
      if (e.key === "ArrowLeft" && urlAnterior)
        navigate(urlAnterior, { preventScrollReset: true });
      if (e.key === "ArrowRight" && urlProxima)
        navigate(urlProxima, { preventScrollReset: true });
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [navigate, urlFechar, urlAnterior, urlProxima]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
      onTouchStart={(e) => {
        toqueX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (toqueX.current === null) return;
        const delta = e.changedTouches[0].clientX - toqueX.current;
        toqueX.current = null;
        if (Math.abs(delta) < 40) return;
        const destino = delta > 0 ? urlAnterior : urlProxima;
        if (destino) navigate(destino, { preventScrollReset: true });
      }}
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <Link to={urlFechar} preventScrollReset className="underline">
          Fechar
        </Link>
        <a href={item.urlDownload} className="underline">
          Baixar original
        </a>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        {item.tipo === "video" ? (
          <video
            controls
            poster={item.urlExibicao}
            src={item.urlAmpliada}
            className="max-h-full max-w-full"
          >
            <track kind="captions" />
          </video>
        ) : (
          <img
            src={item.urlAmpliada}
            alt={item.alt}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        {urlAnterior ? (
          <Link to={urlAnterior} preventScrollReset className="underline">
            ← Anterior
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="text-sm">{item.legenda}</span>
        {urlProxima ? (
          <Link to={urlProxima} preventScrollReset className="underline">
            Próxima →
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
