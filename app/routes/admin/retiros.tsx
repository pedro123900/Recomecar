import { Form, Link, data, useSearchParams } from "react-router";
import type { Route } from "./+types/retiros";
import { contextoCloudflare } from "~/lib/contexto";
import { slugify } from "~/lib/slug";
import type { Retiro } from "~/lib/tipos";

export function meta() {
  return [{ title: "Gestão de retiros — Grupo Recomeçar" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(contextoCloudflare);
  const { results } = await env.DB.prepare(
    "SELECT * FROM retiros ORDER BY data_inicio DESC",
  ).all<Retiro>();
  return { retiros: results };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(contextoCloudflare);
  const db = env.DB;
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
          serie,
          numero,
          slug,
          titulo,
          dataInicio,
          dataFim,
          texto("padroeiro_nome"),
          texto("padroeiro_invocacao"),
          texto("link_drive"),
          publicado,
        )
        .run();
      return { ok: true };
    }

    if (intent === "editar") {
      // Slug nunca é recalculado de série/número/título: vai para o banco o
      // que está no campo (normalizado), pré-preenchido com o valor salvo.
      const slug = slugify(slugDigitado ?? "");
      await db
        .prepare(
          `UPDATE retiros SET serie = ?, numero = ?, slug = ?, titulo = ?,
             data_inicio = ?, data_fim = ?, padroeiro_nome = ?,
             padroeiro_invocacao = ?, link_drive = ?, publicado = ?
           WHERE id = ?`,
        )
        .bind(
          serie,
          numero,
          slug,
          titulo,
          dataInicio,
          dataFim,
          texto("padroeiro_nome"),
          texto("padroeiro_invocacao"),
          texto("link_drive"),
          publicado,
          Number(form.get("id")),
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
            <th>Edição</th>
            <th>Slug</th>
            <th>Datas</th>
            <th>Publicado</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {loaderData.retiros.map((r) => (
            <tr key={r.id}>
              <td>
                {r.numero} {r.serie} — {r.titulo}
              </td>
              <td>{r.slug}</td>
              <td>
                {r.data_inicio} a {r.data_fim}
              </td>
              <td>{r.publicado ? "sim" : "não"}</td>
              <td>
                <Link to={`?editar=${r.id}`}>Editar</Link>{" "}
                <Link to={`/admin/retiros/${r.slug}/cronograma`}>
                  Cronograma
                </Link>{" "}
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
        <input
          type="hidden"
          name="intent"
          value={editando ? "editar" : "criar"}
        />
        {editando && <input type="hidden" name="id" value={editando.id} />}
        <p>
          <label>
            Série{" "}
            <select name="serie" defaultValue={editando?.serie ?? "Recomeçar"}>
              <option>Recomeçar</option>
              <option>Renascer</option>
            </select>
          </label>{" "}
          <label>
            Número{" "}
            <input
              name="numero"
              type="number"
              min={1}
              required
              defaultValue={editando?.numero}
            />
          </label>
        </p>
        <p>
          <label>
            Slug{" "}
            <input
              name="slug"
              defaultValue={editando?.slug}
              placeholder="em branco: gera de número+série"
            />
          </label>
        </p>
        <p>
          <label>
            Título <input name="titulo" required defaultValue={editando?.titulo} />
          </label>
        </p>
        <p>
          <label>
            Início{" "}
            <input
              name="data_inicio"
              type="date"
              required
              defaultValue={editando?.data_inicio}
            />
          </label>{" "}
          <label>
            Fim{" "}
            <input
              name="data_fim"
              type="date"
              required
              defaultValue={editando?.data_fim}
            />
          </label>
        </p>
        <p>
          <label>
            Padroeiro{" "}
            <input
              name="padroeiro_nome"
              defaultValue={editando?.padroeiro_nome ?? ""}
            />
          </label>{" "}
          <label>
            Invocação{" "}
            <input
              name="padroeiro_invocacao"
              defaultValue={editando?.padroeiro_invocacao ?? ""}
            />
          </label>
        </p>
        <p>
          <label>
            Link do Drive (edições antigas){" "}
            <input
              name="link_drive"
              type="url"
              defaultValue={editando?.link_drive ?? ""}
            />
          </label>
        </p>
        <p>
          <label>
            <input
              name="publicado"
              type="checkbox"
              defaultChecked={editando ? editando.publicado === 1 : false}
            />{" "}
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
