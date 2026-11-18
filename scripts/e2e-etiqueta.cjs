// Teste ponta a ponta: Caderno de códigos (impressora pequena) monta a folha com imagens e chama print (ambiente LOCAL).
const { chromium } = require("playwright");
const assert = require("assert/strict");
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  page.on("dialog", d => d.accept());
  // print() de qualquer frame só registra (sem diálogo de verdade)
  await page.addInitScript(() => { window.print = () => { try { (window.top.__prints ||= []).push({ imgs: document.images.length, ok: [...document.images].every(i => i.complete && i.naturalWidth > 0) }); } catch {} }; });
  await page.goto("http://localhost:3002"); await page.getByText("Teste", { exact: true }).click();
  for (const n of "1234") await page.getByRole("button", { name: n, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator(".sidebar").getByRole("button", { name: /Estoque/ }).click(); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Caderno de códigos/ }).click();
  await page.getByRole("button", { name: /Pequena/ }).click();
  const caixas = page.locator("input[type=checkbox]");
  await caixas.nth(0).check(); await caixas.nth(1).check();
  await page.getByRole("button", { name: /Imprimir 2 código/ }).click();
  await page.waitForTimeout(3000);
  const prints = await page.evaluate(() => window.__prints);
  assert.ok(prints?.length === 1, "print chamado 1 vez: " + JSON.stringify(prints));
  assert.equal(prints[0].imgs, 2); assert.ok(prints[0].ok, "imagens carregadas");
  // a folha também gera PDF (o que a prévia do Chrome faz)
  const html = await page.evaluate(() => document.querySelector("iframe[data-impressao]").srcdoc);
  const p2 = await b.newPage(); await p2.setContent(html); const pdf = await p2.pdf({ preferCSSPageSize: true });
  assert.ok(pdf.length > 5000, "pdf " + pdf.length);
  require("fs").writeFileSync("/var/tmp/etiqueta-teste.pdf", pdf);
  await page.getByRole("button", { name: /Abrir a folha em outra aba/ }).waitFor();
  await b.close(); console.log("OK: etiqueta pequena imprime com imagens; pdf", pdf.length, "bytes");
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });
