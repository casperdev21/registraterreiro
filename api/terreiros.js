import { getSql, closeSql, ensureSchema, send, readBody, UFS, TRADICOES, clip, novoProtocolo } from "./_db.js";

export default async function handler(req, res) {
  const db = getSql();
  if (!db) return send(res, 503, { erro: "O banco de dados ainda não foi conectado." });
  try {
    await ensureSchema(db);

    if (req.method === "GET") {
      const rows = await db`
        select id, nome, tradicao, dirigente, endereco, bairro, cidade, uf, dias, horario, aberta, link, fone, descricao
        from registra.terreiros where status = 'aprovado' order by nome`;
      if (!Array.isArray(rows) || rows.some((r) => typeof r.nome !== "string")) {
        throw new Error("Resposta inesperada do banco na listagem de terreiros");
      }
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
      res.status(200).setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify(rows));
    }

    if (req.method === "POST") {
      const b = await readBody(req);
      if (b.website) return send(res, 200, { ok: true }); // armadilha para robôs
      if (b.consentimento !== true) return send(res, 400, { erro: "É preciso autorizar a publicação dos dados." });
      const d = {
        nome: clip(b.nome, 120),
        tradicao: TRADICOES.includes(b.tradicao) ? b.tradicao : "Outra",
        dirigente: clip(b.dirigente, 80),
        endereco: clip(b.endereco, 160),
        bairro: clip(b.bairro, 80),
        cidade: clip(b.cidade, 80),
        uf: UFS.includes(b.uf) ? b.uf : "",
        dias: Array.isArray(b.dias) ? [...new Set(b.dias.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))] : [],
        horario: clip(b.horario, 40),
        aberta: b.aberta !== false,
        link: clip(b.link, 160),
        fone: clip(b.fone, 30),
        descricao: clip(b.descricao, 600),
      };
      d.contato_responsavel = clip(b.contato_responsavel, 120);
      if (!d.nome) return send(res, 400, { erro: "Informe o nome da casa." });
      if (!d.cidade || !d.uf) return send(res, 400, { erro: "Informe cidade e UF." });
      if (d.contato_responsavel.length < 6) return send(res, 400, { erro: "Informe um e-mail ou WhatsApp para darmos retorno sobre o cadastro." });
      const [{ n }] = await db`select count(*)::int as n from registra.terreiros where status = 'pendente'`;
      if (n >= 500) return send(res, 429, { erro: "Muitos cadastros aguardando análise. Tente novamente mais tarde." });
      d.protocolo = novoProtocolo();
      await db`insert into registra.terreiros ${db(d, "nome", "tradicao", "dirigente", "endereco", "bairro", "cidade", "uf", "dias", "horario", "aberta", "link", "fone", "descricao", "contato_responsavel", "protocolo")}`;
      return send(res, 201, { ok: true, protocolo: d.protocolo });
    }

    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { erro: "Método não permitido." });
  } catch (e) {
    console.error(e);
    return send(res, 500, { erro: "Erro interno. Tente novamente em instantes." });
  } finally {
    await closeSql(db);
  }
}
