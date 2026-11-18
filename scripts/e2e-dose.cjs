// Teste ponta a ponta: "Dose R$ 4,00" pergunta qual pinga e tira 50 ml da garrafa certa (ambiente LOCAL).
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const assert = require("assert/strict");
const sql = (q) => execFileSync("psql", ["-h","/tmp","-p","5499","-U","postgres","-d","postgres","-Atqc",q],{encoding:"utf8"}).trim();
const S = "testeadega";
(async () => {
  sql(`delete from ${S}.produto_insumos where produto_id in (select id from ${S}.produtos where nome like '%DOSE E2E%');
       delete from ${S}.produtos where nome like '%DOSE E2E%';
       insert into ${S}.produtos (nome,categoria,preco,unidade,estoque_atual,estoque_minimo,controla_estoque,ativo,volume_ml,fracao_unidade,codigo_barras) values
         ('Garrafa Pitu DOSE E2E','bebida quente',20,'un',2,0,true,true,1000,'ml',null),
         ('Garrafa 51 DOSE E2E','bebida quente',20,'un',2,0,true,true,1000,'ml',null),
         ('Dose R$ 4,00 DOSE E2E','dose e2e',4,'un',0,0,false,true,null,'ml','2000000000046'),
         ('Dose Pitu DOSE E2E','dose e2e',4,'un',0,0,false,true,null,'ml',null),
         ('Dose 51 DOSE E2E','dose e2e',4,'un',0,0,false,true,null,'ml',null);
       insert into ${S}.produto_insumos (produto_id, insumo_id, quantidade)
         select d.id, g.id, 50 from ${S}.produtos d join ${S}.produtos g on (d.nome, g.nome) in (('Dose Pitu DOSE E2E','Garrafa Pitu DOSE E2E'),('Dose 51 DOSE E2E','Garrafa 51 DOSE E2E'));`);
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 900 } });
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:3002"); await page.getByText("Teste", { exact: true }).click();
  for (const n of "1234") await page.getByRole("button", { name: n, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator(".sidebar").getByRole("button", { name: /Venda Rápida/ }).click(); await page.waitForTimeout(1500);
  const busca = page.getByPlaceholder(/Buscar produto/); await busca.fill("2000000000046"); await busca.press("Enter"); await page.waitForTimeout(500);
  await page.getByText("Qual foi servida?").waitFor();
  await page.getByRole("button", { name: "Pitu DOSE E2E R$ 4,00", exact: true }).click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Finalizar Venda/ }).click(); await page.waitForTimeout(2000);
  const v = sql(`select nome || ':' || estoque_atual || ':' || coalesce(ml_aberto,0) from ${S}.produtos where nome like 'Garrafa % DOSE E2E' order by nome`);
  assert.equal(v, "Garrafa 51 DOSE E2E:2:0.00\nGarrafa Pitu DOSE E2E:2:950.00", v);
  sql(`delete from ${S}.produto_insumos where produto_id in (select id from ${S}.produtos where nome like '%DOSE E2E%')`);
  await b.close(); console.log("OK: dose por valor pergunta a pinga e tira 50 ml da garrafa certa");
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });
