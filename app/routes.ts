import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("retiros", "routes/retiros.tsx"),
  route("retiros/:edicao", "routes/retiro/capa.tsx"),
  route("retiros/:edicao/pastas", "routes/retiro/pastas.tsx"),
  route("retiros/:edicao/pastas/:dia", "routes/retiro/pastas-dia.tsx"),
  route("retiros/:edicao/linha-do-tempo", "routes/retiro/linha-do-tempo.tsx"),
  route("retiros/:edicao/fotos", "routes/retiro/fotos.tsx"),
  route("biblioteca", "routes/biblioteca.tsx"),
  route("musica", "routes/musica.tsx"),
  route("midia/*", "routes/midia.ts"),
  route("admin", "routes/admin/index.tsx"),
  route("admin/retiros", "routes/admin/retiros.tsx"),
  route("admin/retiros/:edicao/cronograma", "routes/admin/cronograma.tsx"),
  route("admin/retiros/:edicao/preparacao", "routes/admin/preparacao.tsx"),
  route("admin/retiros/:edicao/albuns", "routes/admin/albuns.tsx"),
  route("admin/retiros/:edicao/albuns/:album", "routes/admin/albuns-album.tsx"),
  route(
    "admin/retiros/:edicao/albuns/:album/acao",
    "routes/admin/albuns-acao.ts",
  ),
  route("admin/retiros/:edicao/upload", "routes/admin/upload.tsx"),
  route("admin/retiros/:edicao/upload/acao", "routes/admin/upload-acao.ts"),
  route("admin/biblioteca", "routes/admin/biblioteca.tsx"),
] satisfies RouteConfig;
