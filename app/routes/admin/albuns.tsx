import { Form, Link, data } from "react-router";
import type { Route } from "./+types/albuns";
import { Coracao } from "~/componentes/coracao";
import { validarCor, validarNome } from "~/lib/albuns";
import { contextoCloudflare } from "~/lib/contexto";
import type { Retiro } from "~/lib/tipos";

export function meta() {
  return [{ title: "Álbuns — Grupo Recomeçar" }];
}

// Paleta dos corações (dado gravado no campo cor, não token de interface —
// exceção decidida, como a cor do card de edição). Valores PROVISÓRIOS:
// a paleta será revisada com o Tuti na fase de skin.
const PALETA: { valor: string; rotulo: string }[] = [
  { valor: "#e02f2f", rotulo: "Vermelho" },
  { valor: "#f57c1f", rotulo: "Laranja" },
  { valor: "#f2c21f", rotulo: "Amarelo" },
  { valor: "#43a047", rotulo: "Verde" },
  { valor: "#1e6fd9", rotulo: "Azul" },
  { valor: "#8e44ad", rotulo: "Roxo" },
  { valor: "#e91e8c", rotulo: "Rosa" },
  { valor: "#8d6e63", rotulo: "Marrom" },
];

async function carregarRetiro(db: D1Database, slug: string): Promise<Retiro> {
  const retiro = await db
    .prepare("SELECT * FROM retiros WHERE slug = ?")
    .bind(slug)
    .first<Retiro>();
  if (!retiro) throw new Response("Retiro não encontrado", { status: 404 });
  return retiro;
}

interface AlbumComTotal {
  id: number;
  nome: string;
  grupo: string | null;
  cor: string | null;
  ordem: number;
  exclusivo: number;
  total: number;
}

export async function loader({ context, params }: Route.LoaderArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const retiro = await carregarRetiro(db, params.edicao);

  // álbum vazio aparece aqui (LEFT JOIN) e some do público
  const { results: albuns } = await db
    .prepare(
      `SELECT a.id, a.nome, a.grupo, a.cor, a.ordem, a.exclusivo,
              COUNT(af.foto_id) AS total
         FROM albuns a LEFT JOIN album_fotos af ON af.album_id = a.id
        WHERE a.retiro_id = ?
        GROUP BY a.id ORDER BY a.ordem, a.id`,
    )
    .bind(retiro.id)
    .all<AlbumComTotal>();

  return { retiro, albuns };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const db = context.get(contextoCloudflare).env.DB;
  const retiro = await carregarRetiro(db, params.edicao);

  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "excluir") {
      // CASCADE apaga os vínculos; as fotos voltam ao tempo sozinhas
      // (exclusividade é computada na consulta, nada a re-taggear)
      await db
        .prepare("DELETE FROM albuns WHERE id = ? AND retiro_id = ?")
        .bind(Number(form.get("id")), retiro.id)
        .run();
      return { ok: true };
    }

    const nome = String(form.get("nome") ?? "").trim();
    const grupo = String(form.get("grupo") ?? "").trim() || null;
    const corBruta = String(form.get("cor") ?? "");
    const cor = corBruta === "" ? null : corBruta;
    const ordemBruta = Number(form.get("ordem"));
    const ordem = Number.isInteger(ordemBruta) ? ordemBruta : 0;
    const exclusivo = form.get("exclusivo") ? 1 : 0;
    if (!nome) return data({ erro: "Preencha o nome." }, { status: 400 });

    const id = intent === "editar" ? Number(form.get("id")) : 0;
    const { results: outros } = await db
      .prepare("SELECT nome FROM albuns WHERE retiro_id = ? AND id <> ?")
      .bind(retiro.id, id)
      .all<{ nome: string }>();
    const erro =
      validarNome(nome, outros.map((o) => o.nome)) ??
      (grupo ? validarNome(grupo, []) : null) ??
      validarCor(cor);
    if (erro) return data({ erro }, { status: 400 });

    if (intent === "adicionar") {
      await db
        .prepare(
          `INSERT INTO albuns (retiro_id, nome, grupo, cor, ordem, exclusivo)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(retiro.id, nome, grupo, cor, ordem, exclusivo)
        .run();
    } else if (intent === "editar") {
      await db
        .prepare(
          `UPDATE albuns SET nome = ?, grupo = ?, cor = ?, ordem = ?, exclusivo = ?
            WHERE id = ? AND retiro_id = ?`,
        )
        .bind(nome, grupo, cor, ordem, exclusivo, id, retiro.id)
        .run();
    } else {
      return data({ erro: "Ação desconhecida." }, { status: 400 });
    }
    return { ok: true };
  } catch (e) {
    return data({ erro: `Erro do banco: ${String(e)}` }, { status: 400 });
  }
}

// Seletor visual da cor: radios com o coração pintado — quem digitava ❤️ no
// nome de pasta do Drive escolhe aqui a cor do coração do álbum.
function SeletorCor({ atual }: { atual: string | null }) {
  return (
    <span>
      Cor:{" "}
      <label title="Sem cor">
        <input type="radio" name="cor" value="" defaultChecked={atual === null} />
        <Coracao cor={null} />
      </label>{" "}
      {PALETA.map((c) => (
        <label key={c.valor} title={c.rotulo}>
          <input
            type="radio"
            name="cor"
            value={c.valor}
            defaultChecked={atual !== null && atual.toLowerCase() === c.valor}
          />
          <Coracao cor={c.valor} />
        </label>
      ))}
    </span>
  );
}

function CamposAlbum({ album }: { album?: AlbumComTotal }) {
  return (
    <>
      <label>
        Nome <input name="nome" required defaultValue={album?.nome ?? ""} />
      </label>{" "}
      <label>
        Grupo{" "}
        <input
          name="grupo"
          list="grupos-existentes"
          defaultValue={album?.grupo ?? ""}
        />
      </label>{" "}
      <label>
        Ordem{" "}
        <input
          name="ordem"
          type="number"
          style={{ width: "4em" }}
          defaultValue={album?.ordem ?? 0}
        />
      </label>{" "}
      <label>
        Exclusivo{" "}
        <input
          type="checkbox"
          name="exclusivo"
          defaultChecked={album ? album.exclusivo === 1 : false}
        />
      </label>
      <br />
      <SeletorCor atual={album?.cor ?? null} />
    </>
  );
}

export default function AdminAlbuns({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { retiro, albuns } = loaderData;
  const erro = actionData && "erro" in actionData ? actionData.erro : null;
  const grupos = [...new Set(albuns.map((a) => a.grupo).filter(Boolean))];

  return (
    <main>
      <h1>Álbuns — {retiro.titulo}</h1>
      <p>
        <Link to="/admin/retiros">← Retiros</Link>
      </p>
      {erro && <p role="alert">{erro}</p>}
      <p>
        <small>
          O álbum <strong>Instagramáveis</strong> alimenta os destaques da capa
          da edição (as primeiras fotos, na ordem manual da curadoria).
          Renomeá-lo desfaz esse vínculo e a capa volta à amostra automática.
        </small>
      </p>

      <datalist id="grupos-existentes">
        {grupos.map((g) => (
          <option key={g} value={g!} />
        ))}
      </datalist>

      <table border={1}>
        <thead>
          <tr>
            <th>Álbum (nome, grupo, ordem, exclusivo, cor)</th>
          </tr>
        </thead>
        <tbody>
          {albuns.map((a) => (
            <tr key={a.id}>
              <td>
                {/* key com os valores atuais: mesmo padrão do construtor —
                    inputs não-controlados remontam quando o dado muda */}
                <Form
                  method="post"
                  style={{ display: "inline" }}
                  key={`${a.id}|${a.nome}|${a.grupo}|${a.cor}|${a.ordem}|${a.exclusivo}`}
                >
                  <input type="hidden" name="intent" value="editar" />
                  <input type="hidden" name="id" value={a.id} />
                  <CamposAlbum album={a} />{" "}
                  <button type="submit">Salvar</button>
                </Form>{" "}
                <Form
                  method="post"
                  style={{ display: "inline" }}
                  onSubmit={(ev) => {
                    if (
                      !confirm(
                        `Excluir "${a.nome}"? As fotos continuam no acervo.`,
                      )
                    )
                      ev.preventDefault();
                  }}
                >
                  <input type="hidden" name="intent" value="excluir" />
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit">Excluir</button>
                </Form>
                <br />
                <small>
                  <Link to={`/admin/retiros/${retiro.slug}/albuns/${a.id}`}>
                    Curadoria
                  </Link>{" "}
                  · {a.total} {a.total === 1 ? "foto" : "fotos"}
                  {a.total === 0 && " (vazio: não aparece no site)"}
                  {a.exclusivo === 1 &&
                    " · exclusivo: as fotos saem das grades do tempo"}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Novo álbum</h2>
      <Form method="post">
        <input type="hidden" name="intent" value="adicionar" />
        <p>
          <CamposAlbum />
        </p>
        <p>
          <button type="submit">Adicionar</button>
        </p>
        <p>
          <small>
            Fotos entram pela curadoria (seleção múltipla), nunca pelo upload.
            Grupo é opcional — um nível, ex.: grupo "Equipes" contém o álbum
            "Anjos".
          </small>
        </p>
      </Form>
    </main>
  );
}
