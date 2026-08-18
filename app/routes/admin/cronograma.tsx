import { Form, Link, data } from "react-router";
import type { Route } from "./+types/cronograma";
import { contextoCloudflare } from "~/lib/contexto";
import {
  calcularAvisos,
  listarDiasLogicos,
  resolverDatetime,
} from "~/lib/cronograma";
import { aplicarRetag } from "~/lib/retag.server";
import type { Momento, Retiro } from "~/lib/tipos";

export function meta() {
  return [{ title: "Cronograma — Grupo Recomeçar" }];
}

async function carregarRetiro(db: D1Database, slug: string): Promise<Retiro> {
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(slug)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });
  return retiro;
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const retiro = await carregarRetiro(db, params.edicao);

  const { results: momentos } = await db
    .prepare("SELECT * FROM momentos WHERE retiro_id = ? ORDER BY inicio")
    .bind(retiro.id)
    .all<Momento>();

  const dias = listarDiasLogicos(retiro);
  const url = new URL(request.url);
  const diaParam = url.searchParams.get("dia");
  const diaAtivo = diaParam && dias.includes(diaParam) ? diaParam : dias[0];
  const doDia = momentos.filter((m) => m.dia === diaAtivo);
  return { retiro, dias, diaAtivo, doDia, avisos: calcularAvisos(doDia) };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const retiro = await carregarRetiro(db, params.edicao);

  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "excluir") {
      // Sem re-encadeamento: o buraco fica visível no aviso.
      await db
        .prepare("DELETE FROM momentos WHERE id = ? AND retiro_id = ?")
        .bind(Number(form.get("id")), retiro.id)
        .run();
      await aplicarRetag(db, retiro.id);
      return { ok: true };
    }

    const dia = String(form.get("dia"));
    const nome = String(form.get("nome") ?? "").trim();
    const horaInicio = String(form.get("hora_inicio") ?? "");
    const horaFim = String(form.get("hora_fim") ?? "");
    const musicaBruta = String(form.get("musica") ?? "").trim();
    const musica = musicaBruta === "" ? null : musicaBruta;
    if (
      !nome ||
      !/^\d\d:\d\d$/.test(horaInicio) ||
      !/^\d\d:\d\d$/.test(horaFim)
    ) {
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
      await aplicarRetag(db, retiro.id);
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
      await aplicarRetag(db, retiro.id);
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
      <p>
        <Link to="/admin/retiros">← Retiros</Link>
      </p>
      {erro && <p role="alert">{erro}</p>}

      <nav>
        {dias.map((d) => {
          const rotulo = d === retiro.data_pre ? `Pré-retiro (${d})` : d;
          return (
            <Link key={d} to={`?dia=${d}`}>
              {d === diaAtivo ? <strong>[{rotulo}]</strong> : rotulo}
            </Link>
          );
        })}
      </nav>

      {avisos.length > 0 && (
        <ul>
          {avisos.map((a, i) => (
            <li key={i}>
              {a.tipo === "buraco" ? "Buraco" : "Sobreposição"} entre "
              {a.entre[0]}" e "{a.entre[1]}"
            </li>
          ))}
        </ul>
      )}

      <table border={1}>
        <thead>
          <tr>
            <th>Momento (nome, início, fim, música)</th>
          </tr>
        </thead>
        <tbody>
          {doDia.map((m) => (
            <tr key={m.id}>
              <td>
                {/* key com os valores atuais: inputs não-controlados só leem
                    defaultValue na montagem; sem remontar, um Salvar após o
                    encadeamento regravaria horários obsoletos */}
                <Form
                  method="post"
                  style={{ display: "inline" }}
                  key={`${m.id}|${m.inicio}|${m.fim}|${m.nome}|${m.musica}`}
                >
                  <input type="hidden" name="intent" value="editar" />
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="dia" value={m.dia} />
                  <input name="nome" defaultValue={m.nome} required />
                  <input
                    name="hora_inicio"
                    type="time"
                    required
                    defaultValue={m.inicio.slice(11, 16)}
                  />
                  <input
                    name="hora_fim"
                    type="time"
                    required
                    defaultValue={m.fim.slice(11, 16)}
                  />
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
                <small>
                  {m.inicio} → {m.fim}
                </small>
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
          <label>
            Nome <input name="nome" required />
          </label>{" "}
          <label>
            Início <input name="hora_inicio" type="time" required />
          </label>{" "}
          <label>
            Fim <input name="hora_fim" type="time" required />
          </label>{" "}
          <label>
            Música <input name="musica" />
          </label>{" "}
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
