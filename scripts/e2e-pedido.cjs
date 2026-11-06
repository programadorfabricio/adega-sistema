// Teste ponta a ponta do pedido online (ambiente LOCAL de teste).
// Precisa: Postgres :5499 (schema testeadega com supabase/pedido-online.sql aplicado),
// PostgREST + proxy em :54321 e o dev server em :3002 com NEXT_PUBLIC_PEDIDO_ONLINE=1.
//   NODE_PATH=$(npm root -g) node scripts/e2e-pedido.cjs [delivery|tudo]
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const assert = require("assert/strict");

const APP = "http://localhost:3002";
const API = "http://localhost:54321/rest/v1";
const sql = (q) => execFileSync("psql", ["-h", "/tmp", "-p", "5499", "-U", "postgres", "-d", "postgres", "-Atqc", q], { encoding: "utf8" }).trim();
const S = "testeadega";

async function rpc(nome, args) {
  const r = await fetch(`${API}/rpc/${nome}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || JSON.stringify(j));
  return j;
}

function preparar() {
  sql(`delete from ${S}.entregas; delete from ${S}.bairros; update ${S}.configuracoes set pedido_online_aberto = true;
       delete from ${S}.produtos where nome like '%E2E%';
       insert into ${S}.bairros (nome, taxa) values ('Centro', 7);
       insert into ${S}.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
         values ('Cerveja E2E', 'cerveja', 10, 'un', 10, 0, true, true), ('Copão E2E', 'copão', 30, 'un', 0, 0, false, true);`);
}
const idProduto = (nome) => sql(`select id from ${S}.produtos where nome = '${nome}'`);
const estoque = (nome) => Number(sql(`select estoque_atual from ${S}.produtos where nome = '${nome}'`));

async function entrar(page) {
  await page.goto(APP);
  await page.getByText("Teste", { exact: true }).click();
  for (const n of "1234") await page.getByRole("button", { name: n, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator(".sidebar").getByRole("button", { name: "Delivery" }).click();
  await page.waitForTimeout(1500);
}

async function testeDelivery(browser) {
  preparar();
  const cli = { nome: "Ana E2E", telefone: "19999990000", endereco: "Rua A, 10", bairro: "Centro", forma_pagamento: "pix" };
  const p1 = await rpc("pedido_online", { p_cliente: cli, p_itens: [{ produto_id: idProduto("Cerveja E2E"), quantidade: 2 }] });
  const p2 = await rpc("pedido_online", { p_cliente: { ...cli, nome: "Bia E2E" }, p_itens: [{ produto_id: idProduto("Cerveja E2E"), quantidade: 1 }] });

  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const erros = []; page.on("pageerror", e => erros.push(String(e)));
  await entrar(page);

  const bloco = page.locator("[data-bloco='pedidos-online']");
  await bloco.waitFor({ timeout: 5000 });
  assert.ok(await bloco.getByText("Ana E2E").isVisible(), "pedido da Ana deveria aparecer em Pedidos online");

  // Aceitar com clique duplo: baixa o estoque uma vez só
  const cartaoAna = bloco.locator("[data-pedido]", { hasText: "Ana E2E" });
  await cartaoAna.getByRole("button", { name: /Aceitar/ }).dblclick();
  await page.waitForTimeout(2000);
  assert.equal(sql(`select status from ${S}.entregas where id = '${p1.id}'`), "preparando");
  assert.equal(estoque("Cerveja E2E"), 8, "aceitar deveria baixar 2 do estoque, uma vez só");

  // Recusar com motivo: estoque não mexe
  page.once("dialog", d => d.accept("Sem motoboy agora"));
  page.context().once("page", p => p.close().catch(() => {})); // aba do WhatsApp
  await bloco.locator("[data-pedido]", { hasText: "Bia E2E" }).getByRole("button", { name: /Recusar/ }).click();
  await page.waitForTimeout(2000);
  assert.equal(sql(`select status || '|' || coalesce(motivo_recusa,'') from ${S}.entregas where id = '${p2.id}'`), "recusado|Sem motoboy agora");
  assert.equal(estoque("Cerveja E2E"), 8, "recusar não deveria mexer no estoque");

  // Liga/desliga recebimento
  await page.getByRole("button", { name: /Recebendo pedidos/ }).click();
  await page.waitForTimeout(1200);
  assert.equal(sql(`select pedido_online_aberto from ${S}.configuracoes limit 1`), "f");
  await page.getByRole("button", { name: /Recebendo pedidos/ }).click();
  await page.waitForTimeout(1200);
  assert.equal(sql(`select pedido_online_aberto from ${S}.configuracoes limit 1`), "t");

  // O pedido aceito segue no fluxo normal (lista do Delivery)
  assert.ok(await page.getByText("Ana E2E").first().isVisible());
  assert.deepEqual(erros, [], `erros na página: ${erros}`);
  await page.close();
  console.log("OK delivery: aceitar (1x), recusar, liga/desliga");
}

async function testeTudo(browser) {
  // Preenchido na Task 4
}

(async () => {
  const qual = process.argv[2] || "tudo";
  const browser = await chromium.launch();
  try {
    await testeDelivery(browser);
    if (qual === "tudo") await testeTudo(browser);
    console.log("E2E PASSOU");
  } catch (e) {
    console.error("E2E FALHOU:", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
