import postgres from "postgres";
import crypto from "node:crypto";

let sql = null;
let ready = null;

export function getSql() {
  const url = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!url) return null;
  if (!sql) sql = postgres(url, { prepare: false, max: 1, ssl: "require" });
  return sql;
}

// Tabelas ficam no schema "registra", que não é exposto pela API pública do Supabase.
export async function ensureSchema(db) {
  if (!ready) {
    ready = (async () => {
      await db`create schema if not exists registra`;
      await db`create table if not exists registra.terreiros (
        id uuid primary key default gen_random_uuid(),
        nome text not null,
        tradicao text not null,
        dirigente text,
        endereco text,
        bairro text,
        cidade text not null,
        uf text not null,
        dias int[] not null default '{}',
        horario text,
        aberta boolean not null default true,
        link text,
        fone text,
        descricao text,
        status text not null default 'pendente',
        criado_em timestamptz not null default now(),
        aprovado_em timestamptz
      )`;
      await db`create table if not exists registra.solicitacoes (
        id uuid primary key default gen_random_uuid(),
        terreiro text not null,
        tipo text not null,
        mensagem text not null,
        contato text,
        resolvida boolean not null default false,
        criado_em timestamptz not null default now()
      )`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export function isAdmin(req) {
  const expected = process.env.ADMIN_SENHA || "";
  const given = String(req.headers["x-admin-senha"] || "");
  if (!expected || expected.length < 8) return false;
  const a = crypto.createHash("sha256").update(expected).digest();
  const b = crypto.createHash("sha256").update(given).digest();
  return crypto.timingSafeEqual(a, b);
}

export function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
export const TRADICOES = ["Umbanda", "Umbanda Branca", "Umbanda Esotérica", "Umbandomblé", "Omolocô", "Candomblé", "Quimbanda", "Outra"];

export const clip = (v, n) => (v == null ? "" : String(v).trim().slice(0, n));
