import { getSql, ensureSchema, send, readBody, isAdmin } from "./_db.js";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  if (!process.env.ADMIN_SENHA) return send(res, 503, { erro: "A senha de administração (ADMIN_SENHA) ainda não foi definida na Vercel." });
  if (!isAdmin(req)) return send(res, 401, { erro: "Senha incorreta." });
  const db = getSql();
  if (!db) return send(res, 503, { erro: "O banco de dados ainda não foi conectado." });
  try {
    await ensureSchema(db);
    if (req.method === "GET") {
      const terreiros = await db`select * from registra.terreiros order by (status = 'pendente') desc, criado_em desc limit 1000`;
      const solicitacoes = await db`select * from registra.solicitacoes where not resolvida order by criado_em desc limit 500`;
      return send(res, 200, { terreiros, solicitacoes });
    }
    if (req.method === "POST") {
      const { acao, id } = await readBody(req);
      if (!UUID.test(String(id || ""))) return send(res, 400, { erro: "Registro inválido." });
      if (acao === "aprovar") await db`update registra.terreiros set status = 'aprovado', aprovado_em = now() where id = ${id}`;
      else if (acao === "ocultar") await db`update registra.terreiros set status = 'pendente' where id = ${id}`;
      else if (acao === "excluir") await db`delete from registra.terreiros where id = ${id}`;
      else if (acao === "resolver") await db`update registra.solicitacoes set resolvida = true where id = ${id}`;
      else return send(res, 400, { erro: "Ação desconhecida." });
      return send(res, 200, { ok: true });
    }
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { erro: "Método não permitido." });
  } catch (e) {
    console.error(e);
    return send(res, 500, { erro: "Erro interno." });
  }
}
