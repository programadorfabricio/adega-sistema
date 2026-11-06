// node --test scripts/carrinho.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { adicionar, alterarQtd, totais, lerCliente, salvarCliente } from "../app/pedir/carrinho.mjs";

const cerveja = { id: "a", nome: "Cerveja", preco: 10 };
const copao = { id: "b", nome: "Copão", preco: 5 };

test("adicionar o mesmo produto duas vezes soma a quantidade", () => {
  const c = adicionar(adicionar([], cerveja), cerveja);
  assert.equal(c.length, 1);
  assert.equal(c[0].quantidade, 2);
});

test("alterarQtd para 0 remove o item", () => {
  const c = alterarQtd(adicionar([], cerveja), "a", 0);
  assert.deepEqual(c, []);
});

test("alterarQtd não passa de 99", () => {
  const c = alterarQtd(adicionar([], cerveja), "a", 150);
  assert.equal(c[0].quantidade, 99);
});

test("totais soma itens e taxa", () => {
  let c = adicionar(adicionar([], cerveja), cerveja);
  c = adicionar(c, copao);
  const t = totais(c, 7);
  assert.equal(t.subtotal, 25);
  assert.equal(t.total, 32);
  assert.deepEqual(t.itens, [{ produto_id: "a", quantidade: 2 }, { produto_id: "b", quantidade: 1 }]);
});

test("lerCliente devolve {} quando o localStorage falha", () => {
  globalThis.localStorage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); } };
  assert.deepEqual(lerCliente(), {});
  assert.doesNotThrow(() => salvarCliente({ nome: "Ana" }));
  delete globalThis.localStorage;
});

test("salvarCliente e lerCliente guardam os dados", () => {
  const mem = {};
  globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  salvarCliente({ nome: "Ana", telefone: "19999990000" });
  assert.deepEqual(lerCliente(), { nome: "Ana", telefone: "19999990000" });
  delete globalThis.localStorage;
});
