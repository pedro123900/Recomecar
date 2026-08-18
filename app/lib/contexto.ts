import { createContext } from "react-router";

// Contexto tipado com os bindings da Cloudflare (API de contexto do RR8).
// Populado no workers/app.ts; lido em loaders/actions com
// context.get(contextoCloudflare).
export const contextoCloudflare = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();
