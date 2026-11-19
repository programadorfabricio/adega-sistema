// Teste: caixa fechado mostra as sangrias com descrição no histórico (ambiente LOCAL).
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const assert = require("assert/strict");
const sql = (q) => execFileSync("psql", ["-h","/tmp","-p","5499","-U","postgres","-d","postgres","-Atqc",q],{encoding:"utf8"}).trim();
const S = "testeadega";
(async () => {
  sql(`with c as (insert into ${S}.caixas (status, aberto_por, troco_inicial, aberto_em, fechado_em, fechado_por, esperado_dinheiro, contado_dinheiro, diferenca, total_vendas, resumo)
        values ('fechado','Teste',100, now() - interval '30 days', now() - interval '29 days','Teste',50,50,0,0,'{"sangrias":50}') returning id)
       insert into ${S}.caixa_movimentos (caixa_id, tipo, valor, motivo, usuario) select id,'sangria',50,'SANGRIA E2E gelo','Teste' from c;`);
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  await page.goto("http://localhost:3002"); await page.getByText("Teste", { exact: true }).click();
  for (const n of "1234") await page.getByRole("button", { name: n, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator(".sidebar").getByRole("button", { name: /Caixa/ }).click(); await page.waitForTimeout(2000);
  const linhas = page.locator("button", { hasText: /Bateu/ });
  const n = await linhas.count();
  let achou = false;
  for (let i = 0; i < n && !achou; i++) {
    await linhas.nth(i).click(); await page.waitForTimeout(700);
    achou = await page.getByText("SANGRIA E2E gelo").isVisible().catch(() => false);
    if (!achou) await page.getByRole("button", { name: "Fechar", exact: true }).click();
  }
  sql(`delete from ${S}.caixas where id in (select caixa_id from ${S}.caixa_movimentos where motivo='SANGRIA E2E gelo')`);
  assert.ok(achou, "descrição da sangria aparece no caixa fechado");
  await b.close(); console.log("OK: sangria com descrição aparece no histórico do caixa");
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });
