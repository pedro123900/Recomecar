# Upload sem campos (fatia vertical) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (Multiagente vetado; commits e push são exclusivos do Pedro.)

**Goal:** `/admin/retiros/:edicao/upload` sem campo nenhum: seleção múltipla, EXIF real (exifr), derivadas no navegador, PUT direto ao R2 com URL assinada, gravação no D1 com tag automática pelo motor.

**Architecture:** Pipeline no cliente (exifr + canvas) produz metadados e derivadas; o servidor só assina URLs (aws4fetch, SigV4 query) e grava no D1 usando `atribuirMomento`. Chaves seguem a convenção ratificada; em dev tudo vai para o prefixo `_teste/` do bucket real (nunca `retiros/`).

**Tech Stack:** exifr e aws4fetch (dependências aprovadas), piexifjs (devDependency aprovada, só para fabricar JPEG de teste), vitest, Playwright via biblioteca local.

**Spec:** Design aprovado em chat (18/08/2026) com 3 ajustes do Pedro: (1) e2e no bucket real sempre sob `_teste/`; (2) coletar `Make`/`Model`/`BodySerialNumber` no upload → colunas `aparelho_*` via migration 0004 (offset em si fica fora); (3) exifr real desde já — **sem stub**: sem EXIF utilizável ⇒ `capturada_em NULL` ⇒ Bastidores.

## Global Constraints

- Segredos **nunca** no repositório nem no chat: token R2 criado pelo Pedro; valores só em `.dev.vars` (gitignored) e `wrangler secret`.
- Datetime canônico `'YYYY-MM-DD HH:MM:SS'` (relógio de parede, sem fuso — EXIF não tem fuso e o cronograma também não).
- `capturada_em` **nunca** vem de mtime/lastModified. Sem EXIF utilizável ⇒ NULL ⇒ Bastidores.
- Convenção de chaves (ratificada): original `retiros/<slug>/originais/<ulid>.<ext>`; derivadas `retiros/<slug>/derivadas/<ulid>/{thumb,media,poster}` **sem extensão**, Content-Type no metadata; em dev o prefixo raiz é `_teste` em vez de `retiros`.
- Upload 100% automático: nenhum campo além da seleção de arquivos.
- Dados sintéticos com nomes fictícios; migrations mostradas ao Pedro antes de aplicar; commit final é dele.
- Vídeo: `capturada_em NULL` nesta fase (data de vídeo será testada com o equipamento real); derivadas de vídeo = poster + thumb (sem média); foto = thumb + média.

---

### Task 1: Credenciais e configuração (parte do Pedro + parte de código)

**Files:**
- Modify: `.gitignore` (garantir `.dev.vars`)
- Modify: `wrangler.jsonc` (vars `CF_ACCOUNT_ID`, `R2_BUCKET`)
- Create: `app/lib/env-secrets.d.ts`

**Interfaces:**
- Produces: `env.CF_ACCOUNT_ID: string`, `env.R2_BUCKET: string`, `env.R2_ACCESS_KEY_ID: string`, `env.R2_SECRET_ACCESS_KEY: string` tipados no `Env`.

- [ ] **Step 1: Passo a passo para o Pedro (ação de conta — os valores nunca passam pelo chat)**

1. Painel Cloudflare → **R2** → **Manage R2 API Tokens** → **Create API Token**: nome `recomecar-upload`, permissão **Object Read & Write**, escopo **Apply to specific buckets** → `recomecar-media`, TTL **Forever** → Create. A tela mostra **Access Key ID** e **Secret Access Key** (copiar os dois; o secret não aparece de novo).
2. Na raiz do projeto, criar `.dev.vars` (fica fora do git):

```
R2_ACCESS_KEY_ID=<colar>
R2_SECRET_ACCESS_KEY=<colar>
```

3. No terminal: `npx wrangler secret put R2_ACCESS_KEY_ID` (colar o valor quando pedir) e `npx wrangler secret put R2_SECRET_ACCESS_KEY`.

- [ ] **Step 2: Conferir `.gitignore` cobre `.dev.vars`; adicionar se faltar**

- [ ] **Step 3: Vars públicas no `wrangler.jsonc`** (account ID não é segredo; aparece em URLs)

```jsonc
"vars": {
  "CF_ACCOUNT_ID": "be495b55e7241e2dbdd3a3628fe86f3e",
  "R2_BUCKET": "recomecar-media"
},
```

- [ ] **Step 4: Tipar os secrets** — `app/lib/env-secrets.d.ts` (o `wrangler types` só tipa o que está na config; declaration merging cobre os secrets):

```ts
// Secrets do Worker (wrangler secret / .dev.vars) — valores nunca no repo.
interface Env {
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}
```

- [ ] **Step 5: `npm run typecheck`** — PASS após regenerar tipos.

### Task 2: Migration 0004 — metadados de aparelho

**Files:**
- Create: `migrations/0004_aparelho.sql`
- Modify: `app/lib/tipos.ts` (interface `Foto`)

**Interfaces:**
- Produces: colunas `aparelho_marca`, `aparelho_modelo`, `aparelho_serial` (TEXT, opcionais) em `fotos`; interface `Foto` completa da linha do banco.

- [ ] **Step 1: Escrever a migration** (GATE: mostrar ao Pedro antes de aplicar)

```sql
-- 0004 — Metadados de aparelho por foto (âncora do offset de relógio).
--
-- O offset por aparelho (CLAUDE.md) agrupa fotos pelo aparelho que as tirou
-- (EXIF Make/Model/BodySerialNumber). Sem colher isso no upload, recolher
-- depois exigiria reler todos os originais. Este item só COLETA: a tela de
-- manutenção do offset fica para a fase do motor. Opcionais — nem todo
-- arquivo tem EXIF de câmera.

ALTER TABLE fotos ADD COLUMN aparelho_marca  TEXT;
ALTER TABLE fotos ADD COLUMN aparelho_modelo TEXT;
ALTER TABLE fotos ADD COLUMN aparelho_serial TEXT;
```

- [ ] **Step 2: Após OK do Pedro: aplicar local** — `npx wrangler d1 migrations apply recomecar-db --local`
- [ ] **Step 3: Sanidade local** — INSERT de foto com e sem os campos novos entra; SELECT confere; limpeza.
- [ ] **Step 4: Aplicar remoto** — `npx wrangler d1 migrations apply recomecar-db --remote`
- [ ] **Step 5: Interface `Foto` em `app/lib/tipos.ts`**

```ts
export interface Foto {
  id: number;
  retiro_id: number;
  arquivo_r2: string;
  tipo: "foto" | "video";
  capturada_em: string | null;
  momento_id: number | null;
  largura: number;
  altura: number;
  duracao: number | null;
  aparelho_marca: string | null;
  aparelho_modelo: string | null;
  aparelho_serial: string | null;
}
```

### Task 3: Libs puras com TDD — ulid, chaves R2, exif

**Files:**
- Create: `app/lib/ulid.ts`, `app/lib/chaves-r2.ts`, `app/lib/exif.ts`
- Test: `app/lib/ulid.test.ts`, `app/lib/chaves-r2.test.ts`, `app/lib/exif.test.ts`

**Interfaces:**
- Produces:
  - `ulid(agora?: number): string` — 26 chars Crockford base32, prefixo temporal ordenável
  - `chaveOriginal(prefixo: string, slug: string, id: string, ext: string): string`
  - `chavesDerivadas(chaveOriginal: string): { thumb: string; media: string; poster: string }` — função pura da chave do original (contrato do CLAUDE.md); lança em chave fora da convenção
  - `formatarDataExif(data: unknown): string | null` — Date → canônico; qualquer outra coisa → null
  - `lerExif(arquivo: Blob | ArrayBuffer | Uint8Array): Promise<MetadadosExif>` com `MetadadosExif = { capturadaEm: string | null; marca: string | null; modelo: string | null; serial: string | null }`

- [ ] **Step 1: Instalar dependências aprovadas** — `npm i exifr aws4fetch && npm i -D piexifjs`
- [ ] **Step 2: Testes vermelhos de ulid** (rodar e ver falhar antes de implementar)

```ts
import { describe, expect, test } from "vitest";
import { ulid } from "./ulid";

describe("ulid", () => {
  test("26 caracteres do alfabeto Crockford", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
  test("prefixo temporal ordena: timestamp maior => string maior", () => {
    expect(ulid(2_000_000_000_000) > ulid(1_000_000_000_000)).toBe(true);
  });
  test("duas chamadas no mesmo instante diferem (parte aleatória)", () => {
    expect(ulid(1_000_000_000_000)).not.toBe(ulid(1_000_000_000_000));
  });
});
```

- [ ] **Step 3: Implementação mínima**

```ts
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// ULID: 10 chars de timestamp (ms, base32 Crockford) + 16 aleatórios.
export function ulid(agora = Date.now()): string {
  let tempo = "";
  let t = agora;
  for (let i = 0; i < 10; i++) {
    tempo = ALFABETO[t % 32] + tempo;
    t = Math.floor(t / 32);
  }
  let aleatorio = "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) aleatorio += ALFABETO[bytes[i] % 32];
  return tempo + aleatorio;
}
```

- [ ] **Step 4: Testes vermelhos de chaves-r2**

```ts
import { describe, expect, test } from "vitest";
import { chaveOriginal, chavesDerivadas } from "./chaves-r2";

describe("convenção de chaves R2 (ratificada)", () => {
  test("original: <prefixo>/<slug>/originais/<id>.<ext>", () => {
    expect(chaveOriginal("retiros", "99-recomecar", "ABC", "jpg")).toBe(
      "retiros/99-recomecar/originais/ABC.jpg",
    );
  });
  test("derivadas são função pura da chave do original, sem extensão", () => {
    expect(chavesDerivadas("retiros/99-recomecar/originais/ABC.jpg")).toEqual({
      thumb: "retiros/99-recomecar/derivadas/ABC/thumb",
      media: "retiros/99-recomecar/derivadas/ABC/media",
      poster: "retiros/99-recomecar/derivadas/ABC/poster",
    });
  });
  test("prefixo _teste (e2e) atravessa sem caso especial", () => {
    expect(chavesDerivadas("_teste/99-recomecar/originais/ABC.png").thumb).toBe(
      "_teste/99-recomecar/derivadas/ABC/thumb",
    );
  });
  test("chave fora da convenção lança", () => {
    expect(() => chavesDerivadas("qualquer/coisa.jpg")).toThrow();
  });
});
```

- [ ] **Step 5: Implementação mínima**

```ts
export function chaveOriginal(
  prefixo: string,
  slug: string,
  id: string,
  ext: string,
): string {
  return `${prefixo}/${slug}/originais/${id}.${ext}`;
}

export function chavesDerivadas(chave: string): {
  thumb: string;
  media: string;
  poster: string;
} {
  const m = chave.match(/^(.+)\/originais\/([^./]+)\.[^.]+$/);
  if (!m) throw new Error(`Chave de original fora da convenção: ${chave}`);
  const [, base, id] = m;
  return {
    thumb: `${base}/derivadas/${id}/thumb`,
    media: `${base}/derivadas/${id}/media`,
    poster: `${base}/derivadas/${id}/poster`,
  };
}
```

- [ ] **Step 6: Testes vermelhos de exif** — `formatarDataExif` + `lerExif` com JPEG fabricado por piexifjs (EXIF sintético; nada de conteúdo real)

```ts
import { describe, expect, test } from "vitest";
// @ts-expect-error piexifjs não tem tipos
import piexif from "piexifjs";
import { formatarDataExif, lerExif } from "./exif";

// 1x1 JPEG válido (base64) para receber o EXIF sintético
const JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
  "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
  "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

function jpegComExif(): Uint8Array {
  const binario = atob(JPEG_BASE64);
  const exif = piexif.dump({
    "0th": {
      [piexif.ImageIFD.Make]: "MarcaTeste",
      [piexif.ImageIFD.Model]: "ModeloTeste",
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: "2099:01:01 20:15:00",
      [piexif.ExifIFD.BodySerialNumber]: "SN123",
    },
  });
  const comExif = piexif.insert(exif, binario);
  return Uint8Array.from(comExif, (c) => c.charCodeAt(0));
}

describe("formatarDataExif", () => {
  test("Date vira o formato canônico, relógio de parede", () => {
    expect(formatarDataExif(new Date(2099, 0, 1, 20, 15, 0))).toBe(
      "2099-01-01 20:15:00",
    );
  });
  test("não-Date e Date inválida viram null", () => {
    expect(formatarDataExif(undefined)).toBeNull();
    expect(formatarDataExif("2099:01:01")).toBeNull();
    expect(formatarDataExif(new Date("lixo"))).toBeNull();
  });
});

describe("lerExif", () => {
  test("JPEG com EXIF sintético: data canônica + aparelho", async () => {
    const m = await lerExif(jpegComExif());
    expect(m.capturadaEm).toBe("2099-01-01 20:15:00");
    expect(m.marca).toBe("MarcaTeste");
    expect(m.modelo).toBe("ModeloTeste");
    expect(m.serial).toBe("SN123");
  });
  test("bytes sem EXIF: tudo null (Bastidores) — nunca mtime", async () => {
    const m = await lerExif(Uint8Array.from(atob(JPEG_BASE64), (c) => c.charCodeAt(0)));
    expect(m).toEqual({ capturadaEm: null, marca: null, modelo: null, serial: null });
  });
});
```

- [ ] **Step 7: Implementação mínima**

```ts
import exifr from "exifr";

export interface MetadadosExif {
  capturadaEm: string | null;
  marca: string | null;
  modelo: string | null;
  serial: string | null;
}

// Date do exifr => 'YYYY-MM-DD HH:MM:SS' (relógio de parede; EXIF não tem
// fuso e o cronograma também não). Qualquer outra coisa => null.
export function formatarDataExif(data: unknown): string | null {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())} ` +
    `${p(data.getHours())}:${p(data.getMinutes())}:${p(data.getSeconds())}`
  );
}

const texto = (v: unknown) => {
  const t = v == null ? "" : String(v).trim();
  return t === "" ? null : t;
};

export async function lerExif(
  arquivo: Blob | ArrayBuffer | Uint8Array,
): Promise<MetadadosExif> {
  try {
    const dados = await exifr.parse(arquivo, [
      "DateTimeOriginal",
      "Make",
      "Model",
      "BodySerialNumber",
    ]);
    return {
      capturadaEm: formatarDataExif(dados?.DateTimeOriginal),
      marca: texto(dados?.Make),
      modelo: texto(dados?.Model),
      serial: texto(dados?.BodySerialNumber),
    };
  } catch {
    // arquivo sem EXIF legível => Bastidores, nunca mtime
    return { capturadaEm: null, marca: null, modelo: null, serial: null };
  }
}
```

- [ ] **Step 8: `npm test`** — tudo verde; `npm run typecheck` — PASS.

### Task 4: Assinatura de URLs (servidor)

**Files:**
- Create: `app/lib/assinatura.server.ts`
- Test: `app/lib/assinatura.test.ts`

**Interfaces:**
- Consumes: `Env` (Task 1), `chaveOriginal`/`chavesDerivadas` (Task 3).
- Produces: `assinarPut(env: Env, chave: string, expiraEmSegundos?: number): Promise<string>`; `prefixoR2(): string` — `"_teste"` em dev, `"retiros"` em produção.

- [ ] **Step 1: Teste vermelho** (aws4fetch roda em node — WebCrypto nativo)

```ts
import { describe, expect, test } from "vitest";
import { assinarPut } from "./assinatura.server";

const envFalso = {
  CF_ACCOUNT_ID: "conta123",
  R2_BUCKET: "recomecar-media",
  R2_ACCESS_KEY_ID: "AKfalso",
  R2_SECRET_ACCESS_KEY: "segredofalso",
} as Env;

describe("assinarPut", () => {
  test("URL aponta para a chave no endpoint do R2 e carrega assinatura SigV4", async () => {
    const url = new URL(await assinarPut(envFalso, "_teste/x/originais/A.jpg"));
    expect(url.hostname).toBe("conta123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/recomecar-media/_teste/x/originais/A.jpg");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
  });
});
```

- [ ] **Step 2: Implementação mínima**

```ts
import { AwsClient } from "aws4fetch";

// Em dev, TODO objeto vai para o prefixo _teste do bucket real — nunca
// retiros/ (regra do Pedro: resíduo de teste fica isolado e visível).
export function prefixoR2(): string {
  return import.meta.env.DEV ? "_teste" : "retiros";
}

export async function assinarPut(
  env: Env,
  chave: string,
  expiraEmSegundos = 900,
): Promise<string> {
  const cliente = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const url = new URL(
    `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${chave}`,
  );
  url.searchParams.set("X-Amz-Expires", String(expiraEmSegundos));
  const assinada = await cliente.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return assinada.url;
}
```

Nota: `import.meta.env.DEV` existe no build do vite; no vitest também (false por padrão em `vitest run`? — o teste acima não depende de `prefixoR2`; se o typecheck reclamar, o teste de `prefixoR2` fica para o e2e).

- [ ] **Step 3: `npm test` verde; typecheck PASS.**

### Task 5: Rota de upload — pipeline no cliente + ações assinar/gravar

**Files:**
- Create: `app/lib/derivadas.client.ts`
- Modify: `app/routes/admin/upload.tsx` (reescrever o stub)

**Interfaces:**
- Consumes: `lerExif`, `ulid`, `chaveOriginal`, `chavesDerivadas`, `assinarPut`, `prefixoR2`, `atribuirMomento`, tipos `Retiro`/`JanelaMomento`.
- Produces (contrato cliente↔ação, JSON):
  - POST `intent=assinar` com `arquivos: [{ nome, mime }]` → `{ itens: [{ id, chaveOriginal, urls: { original, thumb, media?, poster? } }] }`
  - POST `intent=gravar` com `fotos: [{ chaveOriginal, tipo, capturadaEm, largura, altura, duracao, marca, modelo, serial }]` → `{ gravadas: n, itens: [{ chaveOriginal, momentoId }] }`

- [ ] **Step 1: `app/lib/derivadas.client.ts`** — canvas puro, sem framework

```ts
// Derivadas no navegador (Workers não rodam binário nativo — CLAUDE.md).
// WebP quando o canvas souber codificar; senão JPEG. Content-Type vai no
// metadata do R2 (derivadas não têm extensão na chave).

export interface Derivada {
  blob: Blob;
  contentType: string;
}

async function paraBlob(canvas: HTMLCanvasElement): Promise<Derivada> {
  const tentar = (tipo: string, q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, tipo, q));
  const webp = await tentar("image/webp", 0.8);
  if (webp && webp.type === "image/webp") {
    return { blob: webp, contentType: "image/webp" };
  }
  const jpeg = await tentar("image/jpeg", 0.82);
  if (!jpeg) throw new Error("canvas.toBlob falhou");
  return { blob: jpeg, contentType: "image/jpeg" };
}

function desenhar(
  fonte: CanvasImageSource,
  largura: number,
  altura: number,
  maxLado: number,
): HTMLCanvasElement {
  const escala = Math.min(1, maxLado / Math.max(largura, altura));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largura * escala));
  canvas.height = Math.max(1, Math.round(altura * escala));
  canvas.getContext("2d")!.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface PipelineFoto {
  largura: number;
  altura: number;
  thumb: Derivada;
  media: Derivada;
}

export async function derivadasDeFoto(arquivo: File): Promise<PipelineFoto> {
  const bitmap = await createImageBitmap(arquivo);
  try {
    return {
      largura: bitmap.width,
      altura: bitmap.height,
      thumb: await paraBlob(desenhar(bitmap, bitmap.width, bitmap.height, 400)),
      media: await paraBlob(desenhar(bitmap, bitmap.width, bitmap.height, 1600)),
    };
  } finally {
    bitmap.close();
  }
}

export interface PipelineVideo {
  largura: number;
  altura: number;
  duracao: number;
  poster: Derivada;
  thumb: Derivada;
}

export function derivadasDeVideo(arquivo: File): Promise<PipelineVideo> {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = url;
    video.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error("vídeo ilegível no navegador"));
    };
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration / 2);
    };
    video.onseeked = async () => {
      try {
        const poster = await paraBlob(
          desenhar(video, video.videoWidth, video.videoHeight, 1600),
        );
        const thumb = await paraBlob(
          desenhar(video, video.videoWidth, video.videoHeight, 400),
        );
        resolver({
          largura: video.videoWidth,
          altura: video.videoHeight,
          duracao: video.duration,
          poster,
          thumb,
        });
      } catch (e) {
        rejeitar(e as Error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
  });
}
```

- [ ] **Step 2: Reescrever `app/routes/admin/upload.tsx`**

Loader: retiro por slug (mesmo `carregarRetiro` padrão das outras rotas — replicar a função local). Ações respondem `Response.json` (chamadas por `fetch` puro, sem RR Form):

```tsx
import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/upload";
import { contextoCloudflare } from "~/lib/contexto";
import { chaveOriginal, chavesDerivadas } from "~/lib/chaves-r2";
import {
  derivadasDeFoto,
  derivadasDeVideo,
  type Derivada,
} from "~/lib/derivadas.client";
import { lerExif } from "~/lib/exif";
import { atribuirMomento, type JanelaMomento } from "~/lib/motor";
import { assinarPut, prefixoR2 } from "~/lib/assinatura.server";
import type { Retiro } from "~/lib/tipos";
import { ulid } from "~/lib/ulid";

export function meta() {
  return [{ title: "Upload — Grupo Recomeçar" }];
}

async function carregarRetiro(db: D1Database, slug: string): Promise<Retiro> {
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(slug)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });
  return retiro;
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const retiro = await carregarRetiro(db, params.edicao);
  return { retiro };
}

const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export async function action({ request, context, params }: Route.ActionArgs) {
  const { env } = context.get(contextoCloudflare);
  const retiro = await carregarRetiro(env.DB, params.edicao);
  const corpo = (await request.json()) as any;

  if (corpo.intent === "assinar") {
    const itens = [];
    for (const arq of corpo.arquivos as { nome: string; mime: string }[]) {
      const ext = EXT_POR_MIME[arq.mime];
      if (!ext) {
        itens.push({ erro: `Tipo não suportado: ${arq.mime} (${arq.nome})` });
        continue;
      }
      const id = ulid();
      const original = chaveOriginal(prefixoR2(), retiro.slug, id, ext);
      const derivadas = chavesDerivadas(original);
      const ehVideo = arq.mime.startsWith("video/");
      itens.push({
        id,
        chaveOriginal: original,
        urls: {
          original: await assinarPut(env, original),
          thumb: await assinarPut(env, derivadas.thumb),
          ...(ehVideo
            ? { poster: await assinarPut(env, derivadas.poster) }
            : { media: await assinarPut(env, derivadas.media) }),
        },
      });
    }
    return Response.json({ itens });
  }

  if (corpo.intent === "gravar") {
    const { results: momentos } = await env.DB
      .prepare("SELECT id, inicio, fim FROM momentos WHERE retiro_id = ?")
      .bind(retiro.id)
      .all<JanelaMomento>();
    const itens = [];
    const comandos = [];
    for (const f of corpo.fotos as {
      chaveOriginal: string;
      tipo: "foto" | "video";
      capturadaEm: string | null;
      largura: number;
      altura: number;
      duracao: number | null;
      marca: string | null;
      modelo: string | null;
      serial: string | null;
    }[]) {
      const momentoId = atribuirMomento(f.capturadaEm, momentos);
      comandos.push(
        env.DB
          .prepare(
            `INSERT INTO fotos (retiro_id, arquivo_r2, tipo, capturada_em,
               momento_id, largura, altura, duracao, aparelho_marca,
               aparelho_modelo, aparelho_serial)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            retiro.id, f.chaveOriginal, f.tipo, f.capturadaEm, momentoId,
            f.largura, f.altura, f.duracao, f.marca, f.modelo, f.serial,
          ),
      );
      itens.push({ chaveOriginal: f.chaveOriginal, momentoId });
    }
    if (comandos.length > 0) await env.DB.batch(comandos);
    return Response.json({ gravadas: comandos.length, itens });
  }

  return Response.json({ erro: "Ação desconhecida." }, { status: 400 });
}

type Estado = { nome: string; fase: string };

export default function AdminUpload({ loaderData }: Route.ComponentProps) {
  const { retiro } = loaderData;
  const [estados, setEstados] = useState<Estado[]>([]);
  const [enviando, setEnviando] = useState(false);

  const atualizar = (i: number, fase: string) =>
    setEstados((es) => es.map((e, j) => (j === i ? { ...e, fase } : e)));

  async function enviar(arquivos: FileList) {
    setEnviando(true);
    const lista = [...arquivos];
    setEstados(lista.map((f) => ({ nome: f.name, fase: "aguardando" })));

    const chamarAcao = (payload: unknown) =>
      fetch(window.location.pathname, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

    const { itens } = await chamarAcao({
      intent: "assinar",
      arquivos: lista.map((f) => ({ nome: f.name, mime: f.type })),
    });

    const gravar: any[] = [];
    for (let i = 0; i < lista.length; i++) {
      const arquivo = lista[i];
      const item = itens[i];
      if (item.erro) {
        atualizar(i, `erro: ${item.erro}`);
        continue;
      }
      try {
        atualizar(i, "lendo EXIF e gerando derivadas");
        const ehVideo = arquivo.type.startsWith("video/");
        const exif = ehVideo
          ? { capturadaEm: null, marca: null, modelo: null, serial: null }
          : await lerExif(arquivo);

        const put = (url: string, corpo: Blob | File, tipo: string) =>
          fetch(url, {
            method: "PUT",
            headers: { "Content-Type": tipo },
            body: corpo,
          }).then((r) => {
            if (!r.ok) throw new Error(`PUT ${r.status}`);
          });

        atualizar(i, "enviando ao R2");
        if (ehVideo) {
          const d = await derivadasDeVideo(arquivo);
          await put(item.urls.original, arquivo, arquivo.type);
          await put(item.urls.thumb, d.thumb.blob, d.thumb.contentType);
          await put(item.urls.poster!, d.poster.blob, d.poster.contentType);
          gravar.push({
            chaveOriginal: item.chaveOriginal, tipo: "video",
            capturadaEm: null, largura: d.largura, altura: d.altura,
            duracao: d.duracao, marca: null, modelo: null, serial: null,
          });
        } else {
          const d = await derivadasDeFoto(arquivo);
          await put(item.urls.original, arquivo, arquivo.type);
          await put(item.urls.thumb, d.thumb.blob, d.thumb.contentType);
          await put(item.urls.media!, d.media.blob, d.media.contentType);
          gravar.push({
            chaveOriginal: item.chaveOriginal, tipo: "foto",
            capturadaEm: exif.capturadaEm, largura: d.largura,
            altura: d.altura, duracao: null, marca: exif.marca,
            modelo: exif.modelo, serial: exif.serial,
          });
        }
        atualizar(i, "enviado");
      } catch (e) {
        atualizar(i, `erro: ${String(e)}`);
      }
    }

    if (gravar.length > 0) {
      const r = await chamarAcao({ intent: "gravar", fotos: gravar });
      for (const g of r.itens as { chaveOriginal: string; momentoId: number | null }[]) {
        const i = gravar.findIndex((x) => x.chaveOriginal === g.chaveOriginal);
        const idx = estadosIndicePorGravar(i);
        // exibição simples: mostra momento atribuído ou Bastidores
        atualizar(idx, g.momentoId === null ? "gravado — Bastidores" : `gravado — momento ${g.momentoId}`);
      }
    }
    setEnviando(false);

    function estadosIndicePorGravar(iGravar: number): number {
      // gravar[] segue a ordem dos arquivos sem erro; mapeia de volta
      let vistos = -1;
      for (let i = 0; i < lista.length; i++) {
        if (!itens[i]?.erro) vistos++;
        if (vistos === iGravar) return i;
      }
      return iGravar;
    }
  }

  return (
    <main>
      <h1>Upload — {retiro.titulo}</h1>
      <p>
        <Link to="/admin/retiros">← Retiros</Link>
      </p>
      <p>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          disabled={enviando}
          onChange={(e) => e.target.files?.length && enviar(e.target.files)}
        />
      </p>
      <ul>
        {estados.map((e, i) => (
          <li key={i}>
            {e.nome} — {e.fase}
          </li>
        ))}
      </ul>
      <p>
        <small>
          Sem campo nenhum: EXIF é lido do arquivo e o momento vem do
          cronograma. Arquivo sem data utilizável cai em Geral/Bastidores.
        </small>
      </p>
    </main>
  );
}
```

- [ ] **Step 3: `npm run typecheck`** — PASS; `npm test` — verde.

### Task 6: E2E — upload de ponta a ponta com re-tag (critério de pronto da fatia)

**Files:**
- Create (scratchpad, fora do repo): `pw/prep-upload.mjs` (gera fixtures), `pw/fluxo-upload.mjs`, `pw/r2-check.mjs`

**Interfaces:**
- Consumes: `.dev.vars` (credenciais, lidas pelo script node — nunca impressas), fluxo do item 1 para criar retiro/cronograma sintéticos.

- [ ] **Step 1: `prep-upload.mjs`** — gera em `pw/fixtures/`: `com-exif.jpg` (piexifjs: base 1x1 + `DateTimeOriginal '2099:01:01 20:15:00'`, `Make 'MarcaTeste'`, `Model 'ModeloTeste'`, `BodySerialNumber 'SN123'`) e `sem-exif.png` (1x1 base64).
- [ ] **Step 2: `r2-check.mjs`** — lê `.dev.vars`, usa aws4fetch: `HEAD` das chaves passadas por argumento (existência + Content-Type) e `DELETE` para limpeza. Nunca imprime credenciais.
- [ ] **Step 3: `fluxo-upload.mjs`** — Playwright:

1. Criar edição "Teste" (quatro datas 2098-12-26 / 2099-01-01..03) e "Momento A" 20:00–21:00 no dia 1 (reusa os helpers do fluxo do item 1).
2. Ir a `/admin/retiros/99-recomecar/upload`; `setInputFiles` com os dois fixtures; aguardar "gravado".
3. Conferir no D1 local (`wrangler d1 execute --local --json`): linha do jpg com `capturada_em '2099-01-01 20:15:00'`, `momento_id` = Momento A, `aparelho_marca 'MarcaTeste'`, `aparelho_modelo 'ModeloTeste'`, `aparelho_serial 'SN123'`; linha do png com `capturada_em NULL`, `momento_id NULL`, aparelho tudo NULL.
4. `r2-check.mjs HEAD`: original + derivadas existem sob `_teste/99-recomecar/`, **nunca** `retiros/`; Content-Type das derivadas presente.
5. **Re-tag retroativo (o teste de vida do projeto):** editar a janela do Momento A para 20:30–21:30 → SQL confirma `momento_id NULL` na foto; editar de volta para 20:00–21:00 → `momento_id` volta ao Momento A.
6. Bônus RESTRICT: tentar excluir a edição com fotos → erro amigável (fica provado o RESTRICT da 0001 via UI).
7. Limpeza: DELETE das fotos via SQL local, `r2-check.mjs DELETE` das chaves em `_teste/`, exclusão da edição pela UI; contagens zeradas.
8. Screenshot da tela de upload com a lista de estados.

- [ ] **Step 4: Rodar tudo; cada conferência bate.**

### Task 7: Verificação final e entrega

- [ ] **Step 1: `npm test` + `npm run typecheck` frescos; fluxo e2e do item 1 re-rodado (regressão).**
- [ ] **Step 2: Entregar ao Pedro lista de arquivos + mensagem de commit (eu não executo git).**

## Self-review

- Cobertura: credenciais (T1), aparelho/0004 (T2), libs puras (T3), assinatura + prefixo `_teste` (T4), pipeline+UI+gravação com motor (T5), e2e com re-tag e bucket real isolado (T6), entrega (T7). Ajustes do Pedro 1–3 todos contemplados.
- Sem placeholders; código completo nos passos de código.
- Consistência de nomes: `assinarPut`/`prefixoR2` (T4) usados em T5; `chaveOriginal`/`chavesDerivadas`/`ulid`/`lerExif` (T3) usados em T5; contrato JSON assinar/gravar declarado em T5 e exercitado em T6.
