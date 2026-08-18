# Admin cru de retiros e cronograma — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (Multiagente/subagentes vetados nesta fase — regra do CLAUDE.md.)

**Goal:** CRUD cru de edições em `/admin/retiros` e construtor de cronograma em `/admin/retiros/:edicao/cronograma` com encadeamento, virada da meia-noite e avisos — sem design algum.

**Architecture:** Rotas React Router 8 (framework mode) com loader/action lendo D1 via `context.cloudflare.env.DB` (load context a ligar no `workers/app.ts`). Lógica de horários e slug em funções puras (`app/lib/`), separadas da UI, para ganharem teste unitário no item 2. Formulários HTML crus com `intent`.

**Tech Stack:** React Router 8, Cloudflare Workers + D1 (binding `DB`), TypeScript. Sem libs novas.

**Spec:** Design aprovado em chat nesta sessão (não há arquivo de spec). Resumo vinculante na seção Contexto abaixo; contrato geral no `CLAUDE.md`.

## Global Constraints

- Datetime no banco: TEXT `'YYYY-MM-DD HH:MM:SS'`, comparação lexicográfica (convenção da migration 0001 — não violar).
- Janela semiaberta: `inicio <= capturada_em < fim`; CHECK `inicio < fim` no banco.
- Nenhum conteúdo real de cronograma em código/teste/seed: só nomes claramente fictícios ("Teste", "Momento A", "Momento B") — repositório é público.
- Sem design: HTML cru, zero CSS novo. DESIGN.md fica para a fase de skin.
- Sem teste unitário neste item (aprovado): funções puras ganham vitest no item 2. Verificação = `npm run typecheck` + fluxo Playwright MCP **antes** de apresentar como pronto.
- Commit único ao final do item via commit-commands, revisado pelo Pedro; push é dele. Sem commits intermediários.
- Idioma de UI, código e mensagens: pt-BR.

## Contexto (decisões fechadas no chat)

- Construtor: "lógica sim, conforto não" — encadeamento (fim do anterior = início do novo), virada da meia-noite com dia lógico e avisos de buraco/sobreposição **entram**; clonar edição e prévia viva **não**.
- Re-tag **não** entra (item 2); quando entrar, será a função do motor chamada ao salvar, nunca SQL duplicado no formulário.
- Campos do retiro: todos menos `tema`. Slug auto-gerado de série+número normalizado (minúsculas, sem acento, hífen), editável na criação, **nunca recalculado** depois de salvo.
- Excluir momento não re-encadeia: deixa o buraco e o aviso aparece.
- Adicionar momento sempre encadeia ao fim do dia lógico (entrada sequencial); inserção no meio se resolve editando depois.

---

### Task 1: Load context Cloudflare no worker

**Files:**
- Modify: `workers/app.ts`

**Interfaces:**
- Produces: `contextoCloudflare` (`app/lib/contexto.ts`) — em loader/action: `context.get(contextoCloudflare).env` tipado como `Env` (com `DB: D1Database`, `MEDIA: R2Bucket`).

> Ajuste em execução: o RR 8.3 removeu o padrão `AppLoadContext` (era RR7); a API atual é `createContext` + `RouterContextProvider`.

- [x] **Step 1: Criar `app/lib/contexto.ts` e reescrever `workers/app.ts`**

```ts
// app/lib/contexto.ts
import { createContext } from "react-router";

export const contextoCloudflare = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();
```

```ts
// workers/app.ts
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
```

- [x] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS (o `wrangler types` gera `Env` com `DB` e `MEDIA`).

### Task 2: Funções puras — slug e horários do cronograma

**Files:**
- Create: `app/lib/slug.ts`
- Create: `app/lib/cronograma.ts`
- Create: `app/lib/tipos.ts`

**Interfaces:**
- Produces:
  - `slugify(texto: string): string`
  - `adicionarDias(data: string, n: number): string` — datas `'YYYY-MM-DD'`
  - `listarDias(dataInicio: string, dataFim: string): string[]`
  - `resolverDatetime(diaLogico: string, referenciaAnterior: string | null, hora: string): string` — `hora` é `'HH:MM'`; retorna `'YYYY-MM-DD HH:MM:SS'`
  - `calcularAvisos(momentos: MomentoJanela[]): Aviso[]`
  - Tipos `Retiro`, `Momento` (linhas do banco), `MomentoJanela`, `Aviso`

- [x] **Step 1: Criar `app/lib/slug.ts`**

```ts
// Normaliza para o formato exigido pelo CHECK do banco: somente [0-9a-z-].
// "9 Recomeçar" => "9-recomecar" (NFD separa o acento; ç vira c).
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [x] **Step 2: Criar `app/lib/tipos.ts`**

```ts
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
```

- [x] **Step 3: Criar `app/lib/cronograma.ts`**

```ts
// Convenções da migration 0001: data 'YYYY-MM-DD', datetime
// 'YYYY-MM-DD HH:MM:SS', comparação lexicográfica válida nesses formatos.

export function adicionarDias(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function listarDias(dataInicio: string, dataFim: string): string[] {
  const dias: string[] = [];
  for (let d = dataInicio; d <= dataFim; d = adicionarDias(d, 1)) {
    dias.push(d);
  }
  return dias;
}

// Resolve um 'HH:MM' digitado para datetime completo dentro do dia lógico.
// Virada da meia-noite: horário menor que o da referência anterior (último
// início do dia, ou o próprio início quando se resolve um fim) significa
// +1 dia no calendário, mantendo o dia lógico da aba.
export function resolverDatetime(
  diaLogico: string,
  referenciaAnterior: string | null,
  hora: string,
): string {
  const base = referenciaAnterior ? referenciaAnterior.slice(0, 10) : diaLogico;
  const candidato = `${base} ${hora}:00`;
  if (referenciaAnterior && candidato < referenciaAnterior) {
    return `${adicionarDias(base, 1)} ${hora}:00`;
  }
  return candidato;
}

export interface MomentoJanela {
  id: number;
  nome: string;
  inicio: string;
  fim: string;
}

export interface Aviso {
  tipo: "buraco" | "sobreposicao";
  entre: [string, string];
}

// Avisos entre momentos adjacentes (ordenados por início) de um dia lógico.
// Encadeamento perfeito é fim === início do próximo (janela semiaberta).
export function calcularAvisos(momentos: MomentoJanela[]): Aviso[] {
  const ordenados = [...momentos].sort((a, b) =>
    a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0,
  );
  const avisos: Aviso[] = [];
  for (let i = 0; i < ordenados.length - 1; i++) {
    const atual = ordenados[i];
    const proximo = ordenados[i + 1];
    if (atual.fim < proximo.inicio) {
      avisos.push({ tipo: "buraco", entre: [atual.nome, proximo.nome] });
    } else if (atual.fim > proximo.inicio) {
      avisos.push({ tipo: "sobreposicao", entre: [atual.nome, proximo.nome] });
    }
  }
  return avisos;
}
```

- [x] **Step 4: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS.

### Task 3: CRUD de edições em `/admin/retiros`

**Files:**
- Modify: `app/routes/admin/retiros.tsx` (reescrever o stub)

**Interfaces:**
- Consumes: `slugify` (Task 2), `Retiro` (Task 2), `context.cloudflare.env.DB` (Task 1).
- Produces: página com lista + formulário; links `/admin/retiros/:slug/cronograma`.

- [x] **Step 1: Reescrever a rota**

Comportamento:
- Loader: `SELECT * FROM retiros ORDER BY data_inicio DESC`.
- Ação por `intent`:
  - `criar`: slug em branco ⇒ `slugify(`${numero} ${serie}`)`; preenchido ⇒ usa como veio (passando por `slugify` para garantir o formato).
  - `editar`: atualiza todos os campos **inclusive slug somente se digitado diferente** — nunca recalcula de série/número/título.
  - `excluir`: DELETE; RESTRICT de fotos vira mensagem de erro, não crash.
- Erros de banco (CHECK, UNIQUE, RESTRICT) capturados e devolvidos como `{ erro }` exibido no topo.
- Edição via `?editar=<id>`: formulário pré-preenchido.

```tsx
import { Form, Link, data, useSearchParams } from "react-router";
import type { Route } from "./+types/retiros";
import { slugify } from "../../lib/slug";
import type { Retiro } from "../../lib/tipos";

export function meta() {
  return [{ title: "Gestão de retiros — Grupo Recomeçar" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { results } = await context.cloudflare.env.DB.prepare(
    "SELECT * FROM retiros ORDER BY data_inicio DESC",
  ).all<Retiro>();
  return { retiros: results };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const form = await request.formData();
  const intent = form.get("intent");
  const texto = (nome: string) => {
    const v = form.get(nome);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  try {
    if (intent === "excluir") {
      await db
        .prepare("DELETE FROM retiros WHERE id = ?")
        .bind(Number(form.get("id")))
        .run();
      return { ok: true };
    }

    const serie = texto("serie");
    const numero = Number(form.get("numero"));
    const titulo = texto("titulo");
    const dataInicio = texto("data_inicio");
    const dataFim = texto("data_fim");
    if (!serie || !numero || !titulo || !dataInicio || !dataFim) {
      return data(
        { erro: "Preencha série, número, título e as duas datas." },
        { status: 400 },
      );
    }
    const slugDigitado = texto("slug");
    const publicado = form.get("publicado") === "on" ? 1 : 0;

    if (intent === "criar") {
      const slug = slugify(slugDigitado ?? `${numero} ${serie}`);
      await db
        .prepare(
          `INSERT INTO retiros (serie, numero, slug, titulo, data_inicio, data_fim,
             padroeiro_nome, padroeiro_invocacao, link_drive, publicado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          serie, numero, slug, titulo, dataInicio, dataFim,
          texto("padroeiro_nome"), texto("padroeiro_invocacao"),
          texto("link_drive"), publicado,
        )
        .run();
      return { ok: true };
    }

    if (intent === "editar") {
      // Slug nunca é recalculado: vai para o banco exatamente o que está no
      // campo (normalizado), que vem pré-preenchido com o valor salvo.
      const slug = slugify(slugDigitado ?? "");
      await db
        .prepare(
          `UPDATE retiros SET serie = ?, numero = ?, slug = ?, titulo = ?,
             data_inicio = ?, data_fim = ?, padroeiro_nome = ?,
             padroeiro_invocacao = ?, link_drive = ?, publicado = ?
           WHERE id = ?`,
        )
        .bind(
          serie, numero, slug, titulo, dataInicio, dataFim,
          texto("padroeiro_nome"), texto("padroeiro_invocacao"),
          texto("link_drive"), publicado, Number(form.get("id")),
        )
        .run();
      return { ok: true };
    }

    return data({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return data({ erro: `Erro do banco: ${String(e)}` }, { status: 400 });
  }
}

export default function AdminRetiros({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [params] = useSearchParams();
  const editandoId = Number(params.get("editar"));
  const editando = loaderData.retiros.find((r) => r.id === editandoId);
  const erro = actionData && "erro" in actionData ? actionData.erro : null;

  return (
    <main>
      <h1>Gestão de retiros</h1>
      {erro && <p role="alert">{erro}</p>}

      <table border={1}>
        <thead>
          <tr>
            <th>Edição</th><th>Slug</th><th>Datas</th><th>Publicado</th><th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {loaderData.retiros.map((r) => (
            <tr key={r.id}>
              <td>{r.numero} {r.serie} — {r.titulo}</td>
              <td>{r.slug}</td>
              <td>{r.data_inicio} a {r.data_fim}</td>
              <td>{r.publicado ? "sim" : "não"}</td>
              <td>
                <Link to={`?editar=${r.id}`}>Editar</Link>{" "}
                <Link to={`/admin/retiros/${r.slug}/cronograma`}>Cronograma</Link>{" "}
                <Form
                  method="post"
                  style={{ display: "inline" }}
                  onSubmit={(e) => {
                    if (!confirm(`Excluir ${r.titulo}?`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="intent" value="excluir" />
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit">Excluir</button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{editando ? `Editar: ${editando.titulo}` : "Nova edição"}</h2>
      <Form method="post" key={editando?.id ?? "nova"}>
        <input type="hidden" name="intent" value={editando ? "editar" : "criar"} />
        {editando && <input type="hidden" name="id" value={editando.id} />}
        <p>
          <label>Série{" "}
            <select name="serie" defaultValue={editando?.serie ?? "Recomeçar"}>
              <option>Recomeçar</option>
              <option>Renascer</option>
            </select>
          </label>{" "}
          <label>Número{" "}
            <input name="numero" type="number" min={1} required
              defaultValue={editando?.numero} />
          </label>
        </p>
        <p>
          <label>Slug{" "}
            <input name="slug" defaultValue={editando?.slug}
              placeholder="em branco: gera de número+série" />
          </label>
        </p>
        <p>
          <label>Título{" "}
            <input name="titulo" required defaultValue={editando?.titulo} />
          </label>
        </p>
        <p>
          <label>Início{" "}
            <input name="data_inicio" type="date" required
              defaultValue={editando?.data_inicio} />
          </label>{" "}
          <label>Fim{" "}
            <input name="data_fim" type="date" required
              defaultValue={editando?.data_fim} />
          </label>
        </p>
        <p>
          <label>Padroeiro{" "}
            <input name="padroeiro_nome"
              defaultValue={editando?.padroeiro_nome ?? ""} />
          </label>{" "}
          <label>Invocação{" "}
            <input name="padroeiro_invocacao"
              defaultValue={editando?.padroeiro_invocacao ?? ""} />
          </label>
        </p>
        <p>
          <label>Link do Drive (edições antigas){" "}
            <input name="link_drive" type="url"
              defaultValue={editando?.link_drive ?? ""} />
          </label>
        </p>
        <p>
          <label>
            <input name="publicado" type="checkbox"
              defaultChecked={editando ? editando.publicado === 1 : false} />{" "}
            Publicado
          </label>
        </p>
        <p>
          <button type="submit">{editando ? "Salvar" : "Criar"}</button>{" "}
          {editando && <Link to="/admin/retiros">Cancelar</Link>}
        </p>
      </Form>
    </main>
  );
}
```

- [x] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS (o typegen cria `./+types/retiros` para a rota admin).

### Task 4: Construtor de cronograma em `/admin/retiros/:edicao/cronograma`

**Files:**
- Modify: `app/routes/admin/cronograma.tsx` (reescrever o stub)

**Interfaces:**
- Consumes: `listarDias`, `resolverDatetime`, `calcularAvisos` (Task 2); tipos `Retiro`, `Momento`; `context.cloudflare.env.DB`.

- [x] **Step 1: Reescrever a rota**

Comportamento:
- Loader: retiro por slug (404 se não existe), momentos por `inicio`, abas = `listarDias(data_inicio, data_fim)`, aba ativa por `?dia=`, avisos calculados **por dia lógico**.
- `adicionar`: referência = último momento do dia (maior `inicio`); `inicio = resolverDatetime(dia, refInicio, horaInicio)`; `fim = resolverDatetime(dia, inicioNovo, horaFim)`; se há referência, `batch` atualiza `fim` da referência para o novo `inicio` (encadeamento) e insere. Sempre encadeia ao fim do dia — inserção no meio se resolve editando.
- `editar`: recalcula `inicio` contra o momento anterior do mesmo dia (excluindo a si mesmo) e `fim` contra o próprio novo início; `batch` atualiza o próprio e o `fim` do anterior.
- `excluir`: DELETE puro, sem re-encadear (o aviso de buraco aparece).
- Horas validadas com `/^\d\d:\d\d$/`; erros de banco viram `{ erro }`.

```tsx
import { Form, Link, data } from "react-router";
import type { Route } from "./+types/cronograma";
import {
  calcularAvisos,
  listarDias,
  resolverDatetime,
} from "../../lib/cronograma";
import type { Momento, Retiro } from "../../lib/tipos";

export function meta() {
  return [{ title: "Cronograma — Grupo Recomeçar" }];
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const db = context.cloudflare.env.DB;
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(params.edicao)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });

  const { results: momentos } = await db
    .prepare("SELECT * FROM momentos WHERE retiro_id = ? ORDER BY inicio")
    .bind(retiro.id)
    .all<Momento>();

  const dias = listarDias(retiro.data_inicio, retiro.data_fim);
  const url = new URL(request.url);
  const diaParam = url.searchParams.get("dia");
  const diaAtivo = diaParam && dias.includes(diaParam) ? diaParam : dias[0];
  const doDia = momentos.filter((m) => m.dia === diaAtivo);
  return { retiro, dias, diaAtivo, doDia, avisos: calcularAvisos(doDia) };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.cloudflare.env.DB;
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(params.edicao)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });

  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "excluir") {
      // Sem re-encadeamento: o buraco fica visível no aviso.
      await db
        .prepare("DELETE FROM momentos WHERE id = ? AND retiro_id = ?")
        .bind(Number(form.get("id")), retiro.id)
        .run();
      return { ok: true };
    }

    const dia = String(form.get("dia"));
    const nome = String(form.get("nome") ?? "").trim();
    const horaInicio = String(form.get("hora_inicio") ?? "");
    const horaFim = String(form.get("hora_fim") ?? "");
    const musicaBruta = String(form.get("musica") ?? "").trim();
    const musica = musicaBruta === "" ? null : musicaBruta;
    if (!nome || !/^\d\d:\d\d$/.test(horaInicio) || !/^\d\d:\d\d$/.test(horaFim)) {
      return data(
        { erro: "Preencha nome, hora de início e hora de fim (HH:MM)." },
        { status: 400 },
      );
    }

    if (intent === "adicionar") {
      const anterior = await db
        .prepare(
          `SELECT * FROM momentos WHERE retiro_id = ? AND dia = ?
           ORDER BY inicio DESC LIMIT 1`,
        )
        .bind(retiro.id, dia)
        .first<Momento>();

      const inicio = resolverDatetime(dia, anterior?.inicio ?? null, horaInicio);
      const fim = resolverDatetime(dia, inicio, horaFim);

      const inserir = db
        .prepare(
          `INSERT INTO momentos (retiro_id, nome, dia, inicio, fim, musica)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(retiro.id, nome, dia, inicio, fim, musica);
      if (anterior) {
        // Encadeamento: o fim do momento anterior passa a ser o novo início.
        await db.batch([
          db
            .prepare("UPDATE momentos SET fim = ? WHERE id = ?")
            .bind(inicio, anterior.id),
          inserir,
        ]);
      } else {
        await inserir.run();
      }
      return { ok: true };
    }

    if (intent === "editar") {
      const id = Number(form.get("id"));
      const anterior = await db
        .prepare(
          `SELECT * FROM momentos WHERE retiro_id = ? AND dia = ? AND id <> ?
             AND inicio < (SELECT inicio FROM momentos WHERE id = ?)
           ORDER BY inicio DESC LIMIT 1`,
        )
        .bind(retiro.id, dia, id, id)
        .first<Momento>();

      const inicio = resolverDatetime(dia, anterior?.inicio ?? null, horaInicio);
      const fim = resolverDatetime(dia, inicio, horaFim);

      const atualizar = db
        .prepare(
          "UPDATE momentos SET nome = ?, inicio = ?, fim = ?, musica = ? WHERE id = ?",
        )
        .bind(nome, inicio, fim, musica, id);
      if (anterior) {
        await db.batch([
          atualizar,
          db
            .prepare("UPDATE momentos SET fim = ? WHERE id = ?")
            .bind(inicio, anterior.id),
        ]);
      } else {
        await atualizar.run();
      }
      return { ok: true };
    }

    return data({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return data({ erro: `Erro do banco: ${String(e)}` }, { status: 400 });
  }
}

export default function AdminCronograma({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { retiro, dias, diaAtivo, doDia, avisos } = loaderData;
  const erro = actionData && "erro" in actionData ? actionData.erro : null;

  return (
    <main>
      <h1>Cronograma — {retiro.titulo}</h1>
      <p><Link to="/admin/retiros">← Retiros</Link></p>
      {erro && <p role="alert">{erro}</p>}

      <nav>
        {dias.map((d) => (
          <Link key={d} to={`?dia=${d}`}>
            {d === diaAtivo ? <strong>[{d}]</strong> : d}
          </Link>
        ))}
      </nav>

      {avisos.length > 0 && (
        <ul>
          {avisos.map((a, i) => (
            <li key={i}>
              {a.tipo === "buraco" ? "Buraco" : "Sobreposição"} entre{" "}
              "{a.entre[0]}" e "{a.entre[1]}"
            </li>
          ))}
        </ul>
      )}

      <table border={1}>
        <thead>
          <tr>
            <th>Nome</th><th>Início</th><th>Fim</th><th>Música</th><th></th>
          </tr>
        </thead>
        <tbody>
          {doDia.map((m) => (
            <tr key={m.id}>
              <td colSpan={5}>
                <Form method="post" style={{ display: "inline" }}>
                  <input type="hidden" name="intent" value="editar" />
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="dia" value={m.dia} />
                  <input name="nome" defaultValue={m.nome} required />
                  <input name="hora_inicio" type="time" required
                    defaultValue={m.inicio.slice(11, 16)} />
                  <input name="hora_fim" type="time" required
                    defaultValue={m.fim.slice(11, 16)} />
                  <input name="musica" defaultValue={m.musica ?? ""} />
                  <button type="submit">Salvar</button>
                </Form>{" "}
                <Form
                  method="post"
                  style={{ display: "inline" }}
                  onSubmit={(e) => {
                    if (!confirm(`Excluir "${m.nome}"?`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="intent" value="excluir" />
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit">Excluir</button>
                </Form>
                <br />
                <small>{m.inicio} → {m.fim}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Novo momento ({diaAtivo})</h2>
      <Form method="post">
        <input type="hidden" name="intent" value="adicionar" />
        <input type="hidden" name="dia" value={diaAtivo} />
        <p>
          <label>Nome <input name="nome" required /></label>{" "}
          <label>Início <input name="hora_inicio" type="time" required /></label>{" "}
          <label>Fim <input name="hora_fim" type="time" required /></label>{" "}
          <label>Música <input name="musica" /></label>{" "}
          <button type="submit">Adicionar</button>
        </p>
        <p>
          <small>
            O fim do momento anterior é encadeado automaticamente ao novo
            início. Hora menor que a do momento anterior vira o dia no
            calendário, mantendo o dia lógico da aba.
          </small>
        </p>
      </Form>
    </main>
  );
}
```

- [x] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: PASS.

### Task 5: Verificação de ponta a ponta (Playwright MCP) e commit

**Files:** nenhum novo (correções pontuais se a verificação revelar problema — bug não trivial passa antes por systematic-debugging).

- [x] **Step 1: Subir o dev server em background**

Run: `npm run dev` (background)
Expected: servidor local com bindings D1/R2 locais (vite plugin da Cloudflare).

- [x] **Step 2: Fluxo completo via Playwright MCP (dados sintéticos fictícios)**

1. `/admin/retiros`: criar edição série "Recomeçar", número 99, título "Teste", datas 2099-01-01 a 2099-01-03, slug em branco → conferir que virou `99-recomecar`.
2. Abrir o cronograma da edição. No dia 2099-01-01: adicionar "Momento A" 20:00–21:00; adicionar "Momento B" início 22:00 (conferir fim de A encadeado para 22:00 e aviso de buraco 21:00→22:00 — não: encadeamento sobrescreve o fim de A para 22:00, então **sem** aviso); adicionar "Momento C" início 01:30 → conferir `inicio = 2099-01-02 01:30:00` com `dia = 2099-01-01` (virada da meia-noite).
3. Editar o início de "Momento B" para 21:30 → conferir fim de A seguiu para 21:30.
4. Editar o início de "Momento C" para 20:30 → vira 2099-01-02? Não: 20:30 < 21:30 do anterior? 20:30 < 21:30 ⇒ +1 dia ⇒ `2099-01-02 20:30:00` — conferir que a regra da virada foi aplicada e o aviso reflete o estado.
5. Excluir "Momento B" → conferir aviso de buraco entre A e C.
6. Testar erro amigável: criar segunda edição com o mesmo slug → mensagem de erro, sem crash.
7. Screenshots das duas telas para o Pedro.
8. Ao final, apagar os dados sintéticos pelo próprio admin (excluir a edição de teste exclui os momentos em cascata).

Expected: cada conferência bate; screenshots capturados.

- [x] **Step 3: Typecheck final**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 4: Preparar o commit (commit-commands), sem push**

Invocar `commit-commands:commit` cobrindo: `workers/app.ts`, `app/lib/*`, as duas rotas admin e este plano. Push é do Pedro.

## Self-review

- Cobertura: load context (T1), funções puras (T2), CRUD (T3), construtor com encadeamento/virada/avisos (T4), verificação + commit (T5) — tudo do design aprovado; clonar/prévia/re-tag corretamente fora.
- Sem placeholders; código completo em cada task.
- Tipos consistentes: `resolverDatetime(diaLogico, referenciaAnterior, hora)` e `calcularAvisos(MomentoJanela[])` usados em T4 como definidos em T2; `Retiro`/`Momento` de `app/lib/tipos.ts` nos dois routes.
