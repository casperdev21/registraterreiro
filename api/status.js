import { getSql, closeSql, ensureSchema, send, normalizaProtocolo } from "./_db.js";

// Consulta pública do andamento de um cadastro pelo protocolo.
// Não devolve dados de contato: só o nome da casa, a situação e o motivo, se houver.
export default async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, { erro: "Método não permitido." }); }
  const codigo = normalizaProtocolo(req.query && req.query.protocolo);
  if (codigo.length !== 8) return send(res, 400, { erro: "Protocolo inválido. Ele tem o formato RT-XXXXXXXX." });
  const db = getSql();
  if (!db) return send(res, 503, { erro: "O banco de dados ainda não foi conectado." });
  try {
    await ensureSchema(db);
    const rows = await db`
      select nome, status, motivo, criado_em, avaliado_em
      from registra.terreiros where protocolo = ${"RT-" + codigo} limit 1`;
    if (!rows.length) return send(res, 404, { erro: "Não encontramos nenhum cadastro com esse protocolo." });
    return send(res, 200, rows[0]);
  } catch (e) {
    console.error(e);
    return send(res, 500, { erro: "Erro interno. Tente novamente em instantes." });
  } finally {
    await closeSql(db);
  }
}
