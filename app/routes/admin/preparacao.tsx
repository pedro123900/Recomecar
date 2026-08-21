import { Form, Link, data } from "react-router";
import type { Route } from "./+types/preparacao";
import { contextoCloudflare } from "~/lib/contexto";
import { listarDiasLogicos } from "~/lib/cronograma";
import {
  eventosEmDiasLogicos,
  normalizarHorario,
  validarHorarioNaData,
} from "~/lib/eventos";
import { dataPorExtensoPtBr } from "~/lib/galeria";
import { aplicarRetag } from "~/lib/retag.server";
import type { Retiro } from "~/lib/tipos";

export function meta() {
  return [{ title: "Preparação — Grupo Recomeçar" }];
}

async function carregarRetiro(db: D1Database, slug: string): Promise<Retiro> {
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(slug)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });
  return retiro;
}

interface EventoComTotal {
  id: number;
  nome: string;
  data: string;
  horario: string | null;
  total: number;
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const retiro = await carregarRetiro(db, params.edicao);

  // evento vazio aparece aqui (LEFT JOIN) e some do público
  const { results: eventos } = await db
    .prepare(
      `SELECT e.id, e.nome, e.data, e.horario, COUNT(f.id) AS total
         FROM eventos e LEFT JOIN fotos f ON f.evento_id = e.id
        WHERE e.retiro_id = ?
        GROUP BY e.id ORDER BY e.data, e.horario, e.id`,
    )
    .bind(retiro.id)
    .all<EventoComTotal>();

  const avisos = eventosEmDiasLogicos(eventos, listarDiasLogicos(retiro));
  return { retiro, eventos, avisos };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const retiro = await carregarRetiro(db, params.edicao);

  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "excluir") {
      // SET NULL manda as fotos ao Geral; o re-tag pode reencaixá-las em
      // outro evento da mesma data
      await db
        .prepare("DELETE FROM eventos WHERE id = ? AND retiro_id = ?")
        .bind(Number(form.get("id")), retiro.id)
        .run();
      await aplicarRetag(db, retiro.id);
      return { ok: true };
    }

    const nome = String(form.get("nome") ?? "").trim();
    const dataEvento = String(form.get("data") ?? "");
    const horario = normalizarHorario(String(form.get("horario") ?? ""));
    if (!nome || !/^\d{4}-\d{2}-\d{2}$/.test(dataEvento)) {
      return data({ erro: "Preencha nome e data." }, { status: 400 });
    }

    const id = intent === "editar" ? Number(form.get("id")) : 0;
    const { results: outrosNaData } = await db
      .prepare(
        "SELECT horario FROM eventos WHERE retiro_id = ? AND data = ? AND id <> ?",
      )
      .bind(retiro.id, dataEvento, id)
      .all<{ horario: string | null }>();
    const erro = validarHorarioNaData(horario, outrosNaData);
    if (erro) return data({ erro }, { status: 400 });

    if (intent === "adicionar") {
      await db
        .prepare(
          "INSERT INTO eventos (retiro_id, nome, data, horario) VALUES (?, ?, ?, ?)",
        )
        .bind(retiro.id, nome, dataEvento, horario)
        .run();
    } else if (intent === "editar") {
      await db
        .prepare(
          "UPDATE eventos SET nome = ?, data = ?, horario = ? WHERE id = ? AND retiro_id = ?",
        )
        .bind(nome, dataEvento, horario, id, retiro.id)
        .run();
    } else {
      return data({ erro: "Ação desconhecida." }, { status: 400 });
    }
    await aplicarRetag(db, retiro.id);
    return { ok: true };
  } catch (e) {
    return data({ erro: `Erro do banco: ${String(e)}` }, { status: 400 });
  }
}

export default function AdminPreparacao({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { retiro, eventos, avisos } = loaderData;
  const erro = actionData && "erro" in actionData ? actionData.erro : null;

  return (
    <main>
      <h1>Preparação — {retiro.titulo}</h1>
      <p>
        <Link to="/admin/retiros">← Retiros</Link>
      </p>
      {erro && <p role="alert">{erro}</p>}

      {avisos.length > 0 && (
        <ul>
          {avisos.map((a) => (
            <li key={a.id}>
              "{a.nome}" cai num dia lógico do retiro ({a.data}): as janelas do
              cronograma vencem; o evento só recebe fotos fora delas.
            </li>
          ))}
        </ul>
      )}

      <table border={1}>
        <thead>
          <tr>
            <th>Evento (nome, data, horário)</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => (
            <tr key={e.id}>
              <td>
                {/* key com os valores atuais: mesmo padrão do construtor —
                    inputs não-controlados remontam quando o dado muda */}
                <Form
                  method="post"
                  style={{ display: "inline" }}
                  key={`${e.id}|${e.nome}|${e.data}|${e.horario}`}
                >
                  <input type="hidden" name="intent" value="editar" />
                  <input type="hidden" name="id" value={e.id} />
                  <input name="nome" defaultValue={e.nome} required />
                  <input name="data" type="date" required defaultValue={e.data} />
                  <input
                    name="horario"
                    type="time"
                    defaultValue={e.horario ? e.horario.slice(0, 5) : ""}
                  />
                  <button type="submit">Salvar</button>
                </Form>{" "}
                <Form
                  method="post"
                  style={{ display: "inline" }}
                  onSubmit={(ev) => {
                    if (!confirm(`Excluir "${e.nome}"?`)) ev.preventDefault();
                  }}
                >
                  <input type="hidden" name="intent" value="excluir" />
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit">Excluir</button>
                </Form>
                <br />
                <small>
                  {dataPorExtensoPtBr(e.data)} · {e.total}{" "}
                  {e.total === 1 ? "foto" : "fotos"}
                  {e.total === 0 && " (vazio: não aparece no site)"}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Novo evento</h2>
      <Form method="post">
        <input type="hidden" name="intent" value="adicionar" />
        <p>
          <label>
            Nome <input name="nome" required />
          </label>{" "}
          <label>
            Data <input name="data" type="date" required />
          </label>{" "}
          <label>
            Horário <input name="horario" type="time" />
          </label>{" "}
          <button type="submit">Adicionar</button>
        </p>
        <p>
          <small>
            Modo dia inteiro: foto com EXIF na data entra sozinha no evento —
            o upload continua sem nenhum campo. Horário só é necessário com
            mais de um evento na mesma data (desempate).
          </small>
        </p>
      </Form>
    </main>
  );
}
