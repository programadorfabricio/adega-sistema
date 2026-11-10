// Teste ponta a ponta: Venda Rápida → fiado e comanda aberta → fiado existente (ambiente LOCAL).
// Precisa: Postgres :5499 (testeadega), PostgREST + proxy :54321, dev server :3002 com schema testeadega.
//   NODE_PATH=$(npm root -g) node scripts/e2e-fiado.cjs
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const assert = require("assert/strict");
const APP = "http://localhost:3002";
const S = "testeadega";
const sql = (q) => execFileSync("psql", ["-h", "/tmp", "-p", "5499", "-U", "postgres", "-d", "postgres", "-Atqc", q], { encoding: "utf8" }).trim();

(async () => {
  sql(`delete from ${S}.comanda_itens where comanda_id in (select id from ${S}.comandas where nome_cliente like '%E2E%');
       delete from ${S}.comandas where nome_cliente like '%E2E%';
       delete from ${S}.produtos where nome like '%E2E%';
       insert into ${S}.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo, codigo_barras)
         values ('Cerveja E2E', 'cerveja', 10, 'un', 10, 0, true, true, '7890000000017');`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  page.on("dialog", d => d.accept());
  await page.goto(APP);
  await page.getByText("Teste", { exact: true }).click();
  for (const n of "1234") await page.getByRole("button", { name: n, exact: true }).click();
  await page.waitForTimeout(1500);

  // 1) Venda Rápida: bipa pela busca (Enter) 2x e pendura num fiado novo
  await page.locator(".sidebar").getByRole("button", { name: /Venda Rápida/ }).click();
  await page.waitForTimeout(1200);
  const busca = page.getByPlaceholder(/Buscar produto/);
  for (let i = 0; i < 2; i++) { await busca.fill("7890000000017"); await busca.press("Enter"); await page.waitForTimeout(300); }
  await page.getByRole("button", { name: /Pendurar no fiado/ }).click();
  await page.getByPlaceholder("Ex.: João da oficina").fill("Cliente E2E");
  await page.getByRole("button", { name: /Lançar no fiado/ }).click();
  await page.waitForTimeout(1500);
  const f = sql(`select c.total::numeric(10,2) || '|' || c.fiado || '|' || sum(i.quantidade) from ${S}.comandas c join ${S}.comanda_itens i on i.comanda_id = c.id where c.nome_cliente = 'Cliente E2E' group by c.id`);
  assert.equal(f, "20.00|true|2", "fiado novo com 2 cervejas: " + f);
  assert.equal(sql(`select estoque_atual from ${S}.produtos where nome = 'Cerveja E2E'`), "8", "estoque baixou 2");

  // 2) Venda Rápida de novo: junta no fiado existente
  await busca.fill("7890000000017"); await busca.press("Enter"); await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Pendurar no fiado/ }).click();
  await page.getByText("Cliente E2E", { exact: true }).click();
  await page.getByRole("button", { name: /Lançar no fiado/ }).click();
  await page.waitForTimeout(1500);
  assert.equal(sql(`select total::numeric(10,2) from ${S}.comandas where nome_cliente = 'Cliente E2E'`), "30.00", "somou no mesmo fiado");

  // 3) Comanda aberta → entra no fiado existente
  sql(`insert into ${S}.comandas (nome_cliente, status, total, fiado) values ('Mesa E2E', 'aberta', 10, false);
       insert into ${S}.comanda_itens (comanda_id, produto_id, quantidade, preco_unitario, subtotal)
         select c.id, p.id, 1, 10, 10 from ${S}.comandas c, ${S}.produtos p where c.nome_cliente = 'Mesa E2E' and p.nome = 'Cerveja E2E';`);
  await page.locator(".sidebar").getByRole("button", { name: /Comandas/ }).click();
  await page.waitForTimeout(1500);
  await page.getByText("Mesa E2E").first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Pendurar/ }).first().click();
  await page.getByText("Cliente E2E", { exact: true }).click();
  await page.getByRole("button", { name: /Lançar no fiado/ }).click();
  await page.waitForTimeout(1500);
  assert.equal(sql(`select count(*) from ${S}.comandas where nome_cliente = 'Mesa E2E'`), "0", "comanda aberta sumiu");
  assert.equal(sql(`select total::numeric(10,2) from ${S}.comandas where nome_cliente = 'Cliente E2E'`), "40.00", "itens da mesa no fiado");
  assert.equal(sql(`select estoque_atual from ${S}.produtos where nome = 'Cerveja E2E'`), "7", "transferir não mexe no estoque");
  await page.screenshot({ path: process.env.SHOT || "/tmp/e2e-fiado.png" });
  await browser.close();
  console.log("OK: fiado pela Venda Rápida e transferência de comanda");
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });
