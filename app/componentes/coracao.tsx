// Coração dos álbuns (Bloco C): ícone "Heart" (weight fill) da Phosphor
// Icons (MIT — https://phosphoricons.com), colado inline para não puxar a
// biblioteca inteira por um único ícone. A cor vem do DADO cor do álbum
// (exceção decidida à disciplina de tokens, como a cor do card de edição);
// sem cor, herda a do texto (currentColor). Emoji na interface é proibido —
// este componente é o substituto do ❤️ que a Holly digitava no Drive.
export function Coracao({ cor }: { cor: string | null }) {
  return (
    <svg
      viewBox="0 0 256 256"
      width="1em"
      height="1em"
      fill={cor ?? "currentColor"}
      aria-hidden="true"
      style={{ display: "inline", verticalAlign: "-0.125em" }}
    >
      <path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z" />
    </svg>
  );
}
