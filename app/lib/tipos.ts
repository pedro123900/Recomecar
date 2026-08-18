// Linhas do banco (migration 0001 + 0002). Booleanos são INTEGER 0/1.
export interface Retiro {
  id: number;
  serie: "Recomeçar" | "Renascer";
  numero: number;
  slug: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  padroeiro_nome: string | null;
  padroeiro_invocacao: string | null;
  link_drive: string | null;
  tema: string | null;
  publicado: number;
}

export interface Momento {
  id: number;
  retiro_id: number;
  nome: string;
  dia: string;
  inicio: string;
  fim: string;
  musica: string | null;
}
