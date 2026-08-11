import type { Route } from "./+types/retiro";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `${params.edicao} — Grupo Recomeçar` }];
}

export default function Retiro({ params }: Route.ComponentProps) {
  return (
    <main>
      <h1>{params.edicao}</h1>
      <p>Em construção.</p>
      <section>
        <h2>Galeria — em construção</h2>
      </section>
    </main>
  );
}
