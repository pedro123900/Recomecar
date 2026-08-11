import type { Route } from "./+types/upload";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Upload ${params.edicao} — Grupo Recomeçar` }];
}

export default function AdminUpload({ params }: Route.ComponentProps) {
  return (
    <main>
      <h1>Upload de mídia — {params.edicao}</h1>
      <p>Em construção.</p>
    </main>
  );
}
