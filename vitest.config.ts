import { defineConfig } from "vitest/config";

// Config próprio do vitest: as funções puras de app/lib não precisam do
// runtime de worker, e o plugin da Cloudflare do vite.config.ts não roda
// dentro do executor de testes.
export default defineConfig({
  test: {
    include: ["app/**/*.test.ts"],
    environment: "node",
  },
});
