import { createRequestHandler, RouterContextProvider } from "react-router";
import { contextoCloudflare } from "../app/lib/contexto";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const contexto = new RouterContextProvider(
      new Map([[contextoCloudflare, { env, ctx }]]),
    );
    return requestHandler(request, contexto);
  },
} satisfies ExportedHandler<Env>;
