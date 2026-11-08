// node --test scripts/cardapio.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerCardapio, semFuncao } from "../app/pedir/cardapio.mjs";

// supabase falso: rpc devolve `rpc`; from(tabela) devolve tabelas[tabela] em qualquer encadeamento
function falso(rpc, tabelas = {}) {
  const chamadas = [];
  const consulta = (t) => {
    const q = { select: (c) => { chamadas.push(`${t}:${c}`); return q; }, eq: () => q, order: () => q, limit: () => q,
      maybeSingle: () => Promise.resolve(tabelas[t]),
      then: (ok, ruim) => Promise.resolve(tabelas[t]).then(ok, ruim) };
    return q;
  };
  return { chamadas, rpc: async () => rpc, from: consulta };
}

const pronto = { loja: { nome: "A", telefone: "1", aberto: true }, bairros: [], produtos: [] };

test("usa cardapio_online quando existe", async () => {
  const sb = falso({ data: pronto, error: null });
  assert.deepEqual(await lerCardapio(sb), { data: pronto, error: null });
  assert.equal(sb.chamadas.length, 0);
});

test("erro de rede não cai nos selects (mantém o que está na tela)", async () => {
  const sb = falso({ data: null, error: { message: "Failed to fetch", code: "" } });
  const r = await lerCardapio(sb);
  assert.equal(r.data, null);
  assert.ok(r.error);
  assert.equal(sb.chamadas.length, 0);
});

test("função não existe (PGRST202) → selects antigos no mesmo formato, sem custo", async () => {
  const sb = falso({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }, {
    produtos: { data: [{ id: 1, nome: "Cerveja", categoria: "cerveja", preco: 10, controla_estoque: true, estoque_atual: 3, preco_custo: 4 }], error: null },
    bairros: { data: [{ id: 9, nome: "Centro", taxa: 7 }], error: null },
    configuracoes: { data: { nome_estabelecimento: "Adega X", telefone: "19", pedido_online_aberto: false, pix: "x" }, error: null },
  });
  const r = await lerCardapio(sb);
  assert.equal(r.error, null);
  assert.deepEqual(r.data, {
    loja: { nome: "Adega X", telefone: "19", aberto: false },
    bairros: [{ nome: "Centro", taxa: 7 }],
    produtos: [{ id: 1, nome: "Cerveja", categoria: "cerveja", preco: 10, controla_estoque: true, estoque_atual: 3 }],
  });
  assert.ok(!sb.chamadas.some(c => c.startsWith("produtos:") && c.includes("*")), "produtos não pode ser select *");
});

test("sem configuração salva → aberto", async () => {
  const sb = falso({ data: null, error: { code: "PGRST202" } }, {
    produtos: { data: [], error: null }, bairros: { data: [], error: null }, configuracoes: { data: null, error: null },
  });
  const r = await lerCardapio(sb);
  assert.equal(r.data.loja.aberto, true);
});

test("semFuncao", () => {
  assert.ok(semFuncao({ code: "PGRST202" }));
  assert.ok(semFuncao({ code: "42883" }));
  assert.ok(!semFuncao({ code: "42501" }));
  assert.ok(!semFuncao(null));
});
