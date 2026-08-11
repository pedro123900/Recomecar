import type { Route } from "./+types/cronograma";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Cronograma ${params.edicao} — Grupo Recomeçar` }];
}

export default function AdminCronograma({ params }: Route.ComponentProps) {
  return (
    <main>
      <h1>Construtor de cronograma — {params.edicao}</h1>
      <p>Em construção.</p>
    </main>
  );
}
