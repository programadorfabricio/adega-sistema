// Teste ponta a ponta: juntar produto repetido no Editar (ambiente LOCAL, ver e2e-fiado.cjs).
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const assert = require("assert/strict");
const sql = (q) => execFileSync("psql", ["-h","/tmp","-p","5499","-U","postgres","-d","postgres","-Atqc",q],{encoding:"utf8"}).trim();
const S = "testeadega";
(async () => {
  sql(`delete from ${S}.produto_insumos where produto_id in (select id from ${S}.produtos where nome like '%JUNTAR E2E%');
       delete from ${S}.estoque_movimentacoes where produto_id in (select id from ${S}.produtos where nome like '%JUNTAR E2E%');
       delete from ${S}.produtos where nome like '%JUNTAR E2E%';
       insert into ${S}.produtos (nome,categoria,preco,unidade,estoque_atual,estoque_minimo,controla_estoque,ativo,codigo_barras) values
         ('Cigarro JUNTAR E2E azul','cigarros',14,'un',9,0,true,true,null),
         ('CIGARRO JUNTAR E2E AZUL','cigarros',14,'un',2,0,true,true,'78900000001'),
         ('Combo JUNTAR E2E','combo',50,'un',0,0,false,true,null);
       insert into ${S}.produto_insumos (produto_id, insumo_id, quantidade)
         select c.id, o.id, 1 from ${S}.produtos c, ${S}.produtos o where c.nome='Combo JUNTAR E2E' and o.nome='CIGARRO JUNTAR E2E AZUL';`);
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1300, height: 1000 } });
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:3002"); await page.getByText("Teste", { exact: true }).click();
  for (const n of "1234") await page.getByRole("button", { name: n, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator(".sidebar").getByRole("button", { name: /Estoque/ }).click(); await page.waitForTimeout(1500);
  await page.getByPlaceholder(/Buscar produto pelo nome/).fill("Cigarro JUNTAR E2E azul"); await page.waitForTimeout(600);
  await page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Cigarro JUNTAR E2E azul", exact: true }) }).getByRole("button").filter({ hasText: /Editar|✏️/ }).first().click();
  await page.getByRole("button", { name: /Juntar aqui/ }).click();
  await page.getByPlaceholder(/Nome do repetido/).fill("juntar e2e azul");
  await page.getByRole("button", { name: /CIGARRO JUNTAR E2E AZUL/ }).click();
  await page.waitForTimeout(1500);
  assert.equal(sql(`select estoque_atual || '|' || coalesce(codigo_barras,'-') from ${S}.produtos where nome='Cigarro JUNTAR E2E azul'`), "11|78900000001");
  assert.equal(sql(`select ativo::text || '|' || coalesce(codigo_barras,'-') from ${S}.produtos where nome='CIGARRO JUNTAR E2E AZUL'`), "false|-");
  assert.equal(sql(`select count(*) from ${S}.produto_insumos i join ${S}.produtos p on p.id=i.insumo_id where p.nome='Cigarro JUNTAR E2E azul'`), "1", "receita apontou pro que ficou");
  assert.equal(sql(`select count(*) from ${S}.estoque_movimentacoes m join ${S}.produtos p on p.id=m.produto_id where p.nome='Cigarro JUNTAR E2E azul' and m.motivo like 'juntou repetido%'`), "1");
  await page.getByRole("button", { name: /^Salvar$/ }).click(); await page.waitForTimeout(1000);
  assert.equal(sql(`select estoque_atual from ${S}.produtos where nome='Cigarro JUNTAR E2E azul'`), "11", "salvar depois não desfaz");
  await b.close(); console.log("OK: juntar repetido");
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });
