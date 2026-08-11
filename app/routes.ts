import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("retiros", "routes/retiros.tsx"),
  route("retiros/:edicao", "routes/retiro.tsx"),
  route("biblioteca", "routes/biblioteca.tsx"),
  route("musica", "routes/musica.tsx"),
  route("admin", "routes/admin/index.tsx"),
  route("admin/retiros", "routes/admin/retiros.tsx"),
  route("admin/retiros/:edicao/cronograma", "routes/admin/cronograma.tsx"),
  route("admin/retiros/:edicao/upload", "routes/admin/upload.tsx"),
  route("admin/biblioteca", "routes/admin/biblioteca.tsx"),
] satisfies RouteConfig;
