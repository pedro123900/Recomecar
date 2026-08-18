// Linhas do banco (migration 0001 + 0002). Booleanos são INTEGER 0/1.
export interface Retiro {
  id: number;
  serie: "Recomeçar" | "Renascer";
  numero: number;
  slug: string;
  titulo: string;
  // dias lógicos como datas explícitas (migration 0003): pré opcional +
  // três dias obrigatórios; início/fim para exibição = dia1/dia3
  data_pre: string | null;
  data_dia1: string;
  data_dia2: string;
  data_dia3: string;
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
