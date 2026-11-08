import { getSql, ensureSchema, send, readBody, clip } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { erro: "Método não permitido." }); }
  const db = getSql();
  if (!db) return send(res, 503, { erro: "O banco de dados ainda não foi conectado." });
  try {
    await ensureSchema(db);
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true });
    const d = {
      terreiro: clip(b.terreiro, 120),
      tipo: b.tipo === "remocao" ? "remocao" : "correcao",
      mensagem: clip(b.mensagem, 1000),
      contato: clip(b.contato, 120),
    };
    if (!d.terreiro || !d.mensagem) return send(res, 400, { erro: "Informe o nome da casa e o que precisa ser feito." });
    const [{ n }] = await db`select count(*)::int as n from registra.solicitacoes where not resolvida`;
    if (n >= 500) return send(res, 429, { erro: "Muitas solicitações em aberto. Tente novamente mais tarde." });
    await db`insert into registra.solicitacoes ${db(d, "terreiro", "tipo", "mensagem", "contato")}`;
    return send(res, 201, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { erro: "Erro interno. Tente novamente em instantes." });
  }
}
