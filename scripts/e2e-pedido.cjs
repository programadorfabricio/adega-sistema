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

async function clientePede(browser, { bloquearStorage = false, nome }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (bloquearStorage) {
    await ctx.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new Error("bloqueado"); } });
    });
  }
  const page = await ctx.newPage();
  const erros = []; page.on("pageerror", e => erros.push(String(e)));
  await page.goto(`${APP}/pedir`);
  await page.getByText("Cerveja E2E").waitFor();
  await page.getByRole("button", { name: "Adicionar Cerveja E2E" }).click();
  await page.getByRole("button", { name: "Mais Cerveja E2E" }).click();
  await page.getByRole("button", { name: "Adicionar Copão E2E" }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("WhatsApp (com DDD)").fill("(19) 98888-7777");
  await page.getByLabel("Endereço (rua e número)").fill("Rua das Flores, 123");
  await page.getByLabel("Bairro").selectOption("Centro");
  await page.getByText("Pix na entrega").click();
  // total na tela: 2×10 + 30 + 7 = 57
  assert.ok(await page.getByText("R$ 57,00").first().isVisible(), "total 57 deveria aparecer na finalização");
  await page.getByRole("button", { name: "Enviar pedido" }).dblclick();
  await page.waitForURL(/\/pedir\/acompanhar\?id=/, { timeout: 10000 });
  await page.locator("[data-status='novo']").waitFor();
  const id = new URL(page.url()).searchParams.get("id");
  return { ctx, page, id, erros };
}

async function testeTudo(browser) {
  preparar();
  const cli = await clientePede(browser, { nome: "Carlos E2E" });
  assert.equal(sql(`select count(*) from ${S}.entregas where cliente_nome = 'Carlos E2E'`), "1", "clique duplo em Enviar não pode criar 2 pedidos");
  assert.equal(sql(`select total from ${S}.entregas where id = '${cli.id}'`), "57.00");
  if (process.env.SHOTS) await cli.page.screenshot({ path: `${process.env.SHOTS}/acompanhar.png` });

  // Adega aceita, sai e entrega
  const adm = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const erros = []; adm.on("pageerror", e => erros.push(String(e)));
  await entrar(adm);
  if (process.env.SHOTS) await adm.screenshot({ path: `${process.env.SHOTS}/delivery.png` });
  await adm.locator("[data-pedido]", { hasText: "Carlos E2E" }).getByRole("button", { name: /Aceitar/ }).click();
  await adm.waitForTimeout(2000);
  assert.equal(estoque("Cerveja E2E"), 8);

  await cli.page.reload();
  await cli.page.locator("[data-status='preparando']").waitFor({ timeout: 8000 });

  await adm.getByRole("button", { name: "🛵 Saiu" }).first().click();
  const modalSaiu = adm.getByRole("button", { name: "Saiu pra entrega" });
  if (await modalSaiu.isVisible().catch(() => false)) await modalSaiu.click();
  await adm.waitForTimeout(1500);
  await cli.page.reload();
  await cli.page.locator("[data-status='saiu']").waitFor({ timeout: 8000 });

  await adm.getByRole("button", { name: "✅ Entregue" }).first().click();
  await adm.getByRole("button", { name: "Confirmar" }).click();
  await adm.waitForTimeout(2000);
  const venda = sql(`select v.total from ${S}.entregas e join ${S}.vendas v on v.id = e.venda_id where e.id = '${cli.id}'`);
  assert.equal(Number(venda), 57, "a venda no caixa deveria ter o mesmo total");
  await cli.page.reload();
  await cli.page.locator("[data-status='entregue']").waitFor({ timeout: 8000 });
  assert.deepEqual([...cli.erros, ...erros], [], "erros nas páginas");
  await cli.ctx.close(); await adm.close();

  // Aba anônima / armazenamento bloqueado: o pedido envia mesmo assim
  const anon = await clientePede(browser, { nome: "Duda E2E", bloquearStorage: true });
  assert.deepEqual(anon.erros, [], `erros com storage bloqueado: ${anon.erros}`);
  await anon.ctx.close();

  // Loja fechada: página avisa e não deixa continuar
  sql(`update ${S}.configuracoes set pedido_online_aberto = false`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto(`${APP}/pedir`);
  await pg.getByText("Fechado no momento").waitFor();
  if (process.env.SHOTS) await pg.screenshot({ path: `${process.env.SHOTS}/fechado.png` });
  assert.ok(await pg.getByRole("button", { name: "Adicionar Cerveja E2E" }).isDisabled());
  sql(`update ${S}.configuracoes set pedido_online_aberto = true`);
  await ctx.close();
  console.log("OK tudo: pedido → aceitar → saiu → entregue → caixa; storage bloqueado; loja fechada");
}

async function testeRevisao(browser) {
  preparar();
  const cli = { nome: "Rev E2E", telefone: "19977776666", endereco: "Rua R, 1", bairro: "Centro", forma_pagamento: "pix" };
  const itens = [{ produto_id: idProduto("Cerveja E2E"), quantidade: 1 }];

  // 1. Acompanhamento: falha de rede numa atualização não pode "sumir" com o pedido
  const p1 = await rpc("pedido_online", { p_cliente: cli, p_itens: itens });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.clock.install();
  await pg.goto(`${APP}/pedir/acompanhar?id=${p1.id}`);
  await pg.locator("[data-status='novo']").waitFor();
  await pg.route("**/rpc/status_pedido_online", r => r.abort());
  await pg.clock.fastForward(16000);
  await pg.waitForTimeout(800);
  assert.equal(await pg.getByText("Pedido não encontrado").count(), 0, "falha de rede não pode mostrar 'não encontrado'");
  assert.equal(await pg.locator("[data-status='novo']").count(), 1, "o pedido deveria continuar na tela");

  // 2. Campos com 16px no celular (iPhone não dá zoom)
  await pg.goto(`${APP}/pedir`);
  await pg.getByRole("button", { name: "Adicionar Cerveja E2E" }).click();
  await pg.getByRole("button", { name: /Continuar/ }).click();
  const tamanhos = await pg.locator("input:not([type=radio]), select").evaluateAll(els => els.map(e => parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(tamanhos.length > 0 && tamanhos.every(t => t >= 16), `campos com fonte < 16px: ${tamanhos}`);
  await ctx.close();

  // 3. Aceitar um pedido que outro caixa já aceitou: avisa e não baixa estoque
  const p2 = await rpc("pedido_online", { p_cliente: { ...cli, nome: "Outro Caixa E2E" }, p_itens: itens });
  const adm = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await entrar(adm);
  const bloco = adm.locator("[data-bloco='pedidos-online']");
  await bloco.locator("[data-pedido]", { hasText: "Outro Caixa E2E" }).waitFor();
  sql(`update ${S}.entregas set status = 'preparando' where id = '${p2.id}'`);
  const antes = estoque("Cerveja E2E");
  await bloco.locator("[data-pedido]", { hasText: "Outro Caixa E2E" }).getByRole("button", { name: /Aceitar/ }).click();
  await adm.waitForTimeout(1500);
  assert.equal(estoque("Cerveja E2E"), antes, "não pode baixar estoque de pedido já aceito");
  assert.ok(await bloco.getByText(/já foi aceito ou recusado/).isVisible(), "deveria avisar que outro caixa já tratou o pedido");

  // 4. Recusar abre o WhatsApp antes de esperar o banco (iPhone bloqueia janela aberta depois)
  const p3 = await rpc("pedido_online", { p_cliente: { ...cli, nome: "Zap E2E" }, p_itens: itens });
  // sai e volta pro Delivery pra recarregar a lista
  await adm.locator(".sidebar").getByRole("button", { name: "Dashboard" }).click();
  await adm.waitForTimeout(800);
  await adm.locator(".sidebar").getByRole("button", { name: "Delivery" }).click();
  await adm.locator("[data-bloco='pedidos-online'] [data-pedido]", { hasText: "Zap E2E" }).waitFor();
  let patchRespondeuEm = 0, janelaAbriuEm = 0;
  await adm.route(`**/entregas?**`, async r => {
    if (r.request().method() !== "PATCH") return r.continue();
    await new Promise(res => setTimeout(res, 1500));
    await r.continue(); patchRespondeuEm = Date.now();
  });
  adm.context().once("page", p => { janelaAbriuEm = Date.now(); p.close().catch(() => {}); });
  adm.once("dialog", d => d.accept("Fechando"));
  await adm.locator("[data-bloco='pedidos-online'] [data-pedido]", { hasText: "Zap E2E" }).getByRole("button", { name: /Recusar/ }).click();
  await adm.waitForTimeout(3000);
  assert.ok(janelaAbriuEm > 0, "deveria abrir o WhatsApp");
  assert.ok(janelaAbriuEm < patchRespondeuEm, "a janela do WhatsApp deve abrir no clique, antes da resposta do banco");
  assert.equal(sql(`select status from ${S}.entregas where id = '${p3.id}'`), "recusado");
  await adm.close();
  console.log("OK revisão: falha de rede, fonte 16px, aceite duplicado em outro caixa, WhatsApp no clique");
}

(async () => {
  const qual = process.argv[2] || "tudo";
  const browser = await chromium.launch();
  try {
    if (qual === "revisao") { await testeRevisao(browser); console.log("E2E PASSOU"); return; }
    await testeDelivery(browser);
    if (qual === "tudo") { await testeTudo(browser); await testeRevisao(browser); }
    console.log("E2E PASSOU");
  } catch (e) {
    console.error("E2E FALHOU:", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
