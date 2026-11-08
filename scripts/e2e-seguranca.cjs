// Teste ponta a ponta do login da loja + PIN conferido no banco (ambiente LOCAL de teste).
// Precisa: Postgres :5499 com testeadega TRANCADO (public.instalar_trava('testeadega')) e o stub auth.jwt(),
// PostgREST (pr.conf com jwt-secret) + proxy em :54321 (repassa "Authorization: Bearer eyJ...")
// e o dev server em :3004 com NEXT_PUBLIC_LOGIN_LOJA=1.
// O Supabase Auth é simulado aqui (page.route): devolve um JWT assinado com o mesmo segredo do PostgREST.
//   NODE_PATH=$(npm root -g) node scripts/e2e-seguranca.cjs
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const assert = require("assert/strict");

const APP = process.env.APP || "http://localhost:3004";
const PR_CONF = process.env.PR_CONF || "/var/tmp/pgrest/pr.conf";
const S = "testeadega";
const sql = (q) => execFileSync("psql", ["-h", "/tmp", "-p", "5499", "-U", "postgres", "-d", "postgres", "-Atqc", q], { encoding: "utf8" }).trim();

const SEGREDO = fs.readFileSync(PR_CONF, "utf8").match(/^jwt-secret\s*=\s*"([^"]+)"/m)[1];
const b64url = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");
function jwt(payload) {
  const corpo = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}`;
  return `${corpo}.${crypto.createHmac("sha256", SEGREDO).update(corpo).digest("base64url")}`;
}

// Conta "loja@<schema>" com senha "senha123" → usuário ligado àquele schema
function usuarioDe(email) {
  const schema = email.split("@")[1];
  return { id: `00000000-0000-4000-8000-${crypto.createHash("md5").update(email).digest("hex").slice(0, 12)}`, aud: "authenticated", role: "authenticated", email, app_metadata: { provider: "email", schema }, user_metadata: {}, created_at: "2026-11-07T00:00:00Z" };
}
async function simularAuth(ctx) {
  let ultimo = null;
  await ctx.route("**/auth/v1/token**", async (r) => {
    const body = JSON.parse(r.request().postData() || "{}");
    if (body.email && body.password !== "senha123") {
      return r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }) });
    }
    const user = body.email ? usuarioDe(body.email) : ultimo;
    if (!user) return r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }) });
    ultimo = user;
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const access_token = jwt({ sub: user.id, aud: "authenticated", role: "authenticated", email: user.email, app_metadata: user.app_metadata, exp });
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token, refresh_token: "x", token_type: "bearer", expires_in: 3600, expires_at: exp, user }) });
  });
  await ctx.route("**/auth/v1/user**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ultimo) }));
  await ctx.route("**/auth/v1/logout**", (r) => r.fulfill({ status: 204, body: "" }));
}

function preparar() {
  assert.ok(Number(sql(`select count(*) from pg_policies where schemaname = '${S}' and policyname like 'loja\\_%'`)) > 0,
    `${S} precisa estar TRANCADO: select public.instalar_trava('${S}')`);
  sql(`update ${S}.usuarios set pin = '1234', ativo = true where nome = 'Teste';
       delete from ${S}.pin_tentativas;
       delete from ${S}.comanda_itens where comanda_id in (select id from ${S}.comandas where nome_cliente = 'Comanda Seg E2E');
       delete from ${S}.comandas where nome_cliente = 'Comanda Seg E2E';
       delete from ${S}.produtos where nome = 'Cerveja Seg E2E';
       insert into ${S}.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
         values ('Cerveja Seg E2E', 'cerveja', 10, 'un', 20, 0, true, true);
       insert into ${S}.comandas (nome_cliente, status, total, atendente_nome) values ('Comanda Seg E2E', 'aberta', 10, 'Teste');
       insert into ${S}.comanda_itens (comanda_id, produto_id, quantidade, preco_unitario, subtotal)
         select c.id, p.id, 1, 10, 10 from ${S}.comandas c, ${S}.produtos p where c.nome_cliente = 'Comanda Seg E2E' and p.nome = 'Cerveja Seg E2E';`);
}

async function contaDaLoja(page, email, senha = "senha123") {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
async function digitar(page, pin, escopo = page) {
  for (const n of pin) await escopo.getByRole("button", { name: n, exact: true }).click();
}
async function irPara(page, tela) {
  await page.locator(".sidebar").getByRole("button", { name: tela }).click();
  await page.waitForTimeout(1200);
}

async function teste(browser) {
  preparar();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await simularAuth(ctx);
  const page = await ctx.newPage();
  const erros = []; page.on("pageerror", e => erros.push(String(e)));
  const comPin = [];
  page.on("response", async (r) => {
    if (!r.url().includes("/rest/v1/")) return;
    const t = await r.text().catch(() => "");
    if (t.includes('"pin"')) comPin.push(`${r.request().method()} ${r.url()}: ${t.slice(0, 200)}`);
  });

  // 1. Sem sessão: tela da conta da loja
  await page.goto(APP);
  await page.getByText("Entrar com a conta da loja").waitFor({ timeout: 15000 });
  assert.equal(await page.getByText("Quem está acessando?").count(), 0, "sem sessão não pode mostrar a lista de usuários");

  // 2. Senha errada e conta de outra adega
  await contaDaLoja(page, "loja@testeadega", "errada");
  await page.getByText(/E-mail ou senha incorretos/).waitFor({ timeout: 5000 });
  await contaDaLoja(page, "loja@testeoutra");
  await page.getByText("Essa conta não é desta adega").waitFor({ timeout: 5000 });
  assert.equal(await page.getByText("Quem está acessando?").count(), 0);

  // 3. Conta certa → PIN; recarregar → direto no PIN (sessão salva)
  await contaDaLoja(page, "loja@testeadega");
  await page.getByText("Quem está acessando?").waitFor({ timeout: 5000 });
  await page.reload();
  await page.getByText("Quem está acessando?").waitFor({ timeout: 15000 });
  assert.equal(await page.getByText("Entrar com a conta da loja").count(), 0, "a sessão da loja deveria continuar depois de recarregar");

  // 4. PIN errado → mensagem com tentativas; certo → entra
  await page.getByText("Teste", { exact: true }).click();
  await digitar(page, "9999");
  await page.getByText("PIN incorreto (restam 4)").waitFor({ timeout: 5000 });
  await page.waitForTimeout(800);
  await digitar(page, "1234");
  await page.locator(".sidebar").waitFor({ timeout: 5000 });
  assert.equal(sql(`select count(*) from ${S}.pin_tentativas`), "0", "PIN certo deveria zerar as tentativas");

  // 5. Venda Rápida grava venda
  const vendasAntes = Number(sql(`select count(*) from ${S}.vendas`));
  await irPara(page, "Venda Rápida");
  await page.getByRole("button", { name: /Cerveja Seg E2E/ }).first().click();
  await page.getByRole("button", { name: /Finalizar Venda/ }).click();
  await page.getByText("Venda registrada!").waitFor({ timeout: 5000 });
  assert.equal(Number(sql(`select count(*) from ${S}.vendas`)), vendasAntes + 1, "deveria gravar uma venda nova");

  // 6. Comandas: remover item pedindo PIN
  await irPara(page, "Comandas");
  await page.getByText("👤 Comanda Seg E2E").first().click();
  await page.waitForTimeout(800);
  await page.locator("button:visible", { hasText: "✕" }).first().click();
  await page.getByText(/Digite seu PIN para remover/).waitFor();
  await digitar(page, "0000");
  await page.getByText("PIN incorreto (restam 4)").waitFor({ timeout: 5000 });
  assert.equal(sql(`select count(*) from ${S}.comanda_itens i join ${S}.comandas c on c.id = i.comanda_id where c.nome_cliente = 'Comanda Seg E2E'`), "1", "PIN errado não pode remover");
  await page.waitForTimeout(1800);
  await digitar(page, "1234");
  await page.waitForTimeout(1500);
  assert.equal(sql(`select count(*) from ${S}.comanda_itens i join ${S}.comandas c on c.id = i.comanda_id where c.nome_cliente = 'Comanda Seg E2E'`), "0", "PIN certo deveria remover o item");

  // 7. Configurações: trocar o PIN do Teste para 5678, sair, entrar com 5678
  await irPara(page, "Configurações");
  const linha = page.locator("tr", { hasText: "Teste" });
  await linha.getByRole("button", { name: /Editar/ }).click();
  await page.getByLabel(/Novo PIN/).fill("5678");
  await page.getByRole("button", { name: "Salvar", exact: true }).last().click();
  await page.waitForTimeout(1200);
  assert.equal(sql(`select pin from ${S}.usuarios where nome = 'Teste'`), "5678", "o PIN novo deveria ser gravado");
  // editar só o nome/cargo sem digitar PIN não apaga o PIN
  await linha.getByRole("button", { name: /Editar/ }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).last().click();
  await page.waitForTimeout(1200);
  assert.equal(sql(`select pin from ${S}.usuarios where nome = 'Teste'`), "5678", "salvar sem PIN novo não pode mudar o PIN");

  await page.locator(".sidebar").getByRole("button", { name: /Sair/ }).click();
  await page.getByText("Teste", { exact: true }).click();
  await digitar(page, "5678");
  await page.locator(".sidebar").waitFor({ timeout: 5000 });

  // 8. "Sair da conta da loja" volta para a tela da conta (pede confirmação)
  await irPara(page, "Configurações");
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: /Sair da conta da loja/ }).click();
  await page.getByText("Entrar com a conta da loja").waitFor({ timeout: 5000 });
  await page.reload();
  await page.getByText("Entrar com a conta da loja").waitFor({ timeout: 15000 });

  // 9. 5 PINs errados → bloqueado
  await contaDaLoja(page, "loja@testeadega");
  await page.getByText("Teste", { exact: true }).click();
  for (let i = 0; i < 5; i++) { await digitar(page, "1111"); await page.waitForTimeout(900); }
  await page.getByText(/Bloqueado até \d\d:\d\d/).waitFor({ timeout: 5000 });

  assert.deepEqual(comPin, [], `respostas da API com "pin":\n${comPin.join("\n")}`);
  assert.deepEqual(erros, [], `erros na página: ${erros}`);
  await ctx.close();
  sql(`update ${S}.usuarios set pin = '1234' where nome = 'Teste'; delete from ${S}.pin_tentativas;`);
  console.log("OK segurança: conta da loja, outra adega, sessão salva, PIN no banco, venda, comanda, troca de PIN, sair da conta, bloqueio");
}

// /pedir sem sessão (cliente final) com a adega trancada: cardápio vem de cardapio_online, pedido chega no Delivery
async function testePedidoTrancado(browser) {
  sql(`delete from ${S}.entregas where cliente_nome = 'Cliente Seg E2E';
       delete from ${S}.produtos where nome = 'Cerveja E2E';
       insert into ${S}.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
         values ('Cerveja E2E', 'cerveja', 10, 'un', 10, 0, true, true);
       insert into ${S}.bairros (nome, taxa) select 'Centro', 7 where not exists (select 1 from ${S}.bairros where nome = 'Centro');
       update ${S}.configuracoes set pedido_online_aberto = true;`);
  const loja = sql(`select nome_estabelecimento from ${S}.configuracoes limit 1`);

  const cli = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await cli.newPage();
  const erros = []; pg.on("pageerror", e => erros.push(String(e)));
  await pg.goto(`${APP}/pedir`);
  await pg.getByText("Cerveja E2E").waitFor({ timeout: 15000 });
  if (loja) assert.ok(await pg.getByText(loja, { exact: true }).isVisible(), "o nome da loja deveria aparecer no cardápio");
  await pg.getByRole("button", { name: "Adicionar Cerveja E2E" }).click();
  await pg.getByRole("button", { name: /Continuar/ }).click();
  await pg.getByLabel("Seu nome").fill("Cliente Seg E2E");
  await pg.getByLabel("WhatsApp (com DDD)").fill("(19) 98888-7777");
  await pg.getByLabel("Endereço (rua e número)").fill("Rua das Flores, 123");
  await pg.getByLabel("Bairro").selectOption("Centro");
  await pg.getByRole("button", { name: "Enviar pedido" }).click();
  await pg.waitForURL(/\/pedir\/acompanhar\?id=/, { timeout: 10000 });
  await pg.getByText("Recebido").first().waitFor({ timeout: 10000 });
  if (loja) assert.ok(await pg.getByText(loja).first().isVisible(), "o acompanhamento deveria mostrar o nome da loja");
  assert.equal(sql(`select count(*) from ${S}.entregas where cliente_nome = 'Cliente Seg E2E'`), "1", "o pedido deveria ser gravado");

  // Loja fechada → "Fechado no momento"
  sql(`update ${S}.configuracoes set pedido_online_aberto = false`);
  await pg.goto(`${APP}/pedir`);
  await pg.getByText("Fechado no momento").waitFor({ timeout: 15000 });
  assert.ok(await pg.getByRole("button", { name: "Adicionar Cerveja E2E" }).isDisabled(), "fechado: não pode adicionar");
  sql(`update ${S}.configuracoes set pedido_online_aberto = true`);
  assert.deepEqual(erros, [], `erros na página: ${erros}`);
  await cli.close();

  // O pedido aparece no Delivery da conta da loja
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await simularAuth(ctx);
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.getByText("Entrar com a conta da loja").waitFor({ timeout: 15000 });
  await contaDaLoja(page, "loja@testeadega");
  await page.getByText("Teste", { exact: true }).click();
  await digitar(page, "1234");
  await page.locator(".sidebar").waitFor({ timeout: 5000 });
  await irPara(page, "Delivery");
  const bloco = page.locator("[data-bloco='pedidos-online']");
  await bloco.getByText("Cliente Seg E2E").waitFor({ timeout: 5000 });
  await ctx.close();
  sql(`delete from ${S}.entregas where cliente_nome = 'Cliente Seg E2E'; delete from ${S}.pin_tentativas;`);
  console.log("OK pedido online trancado: cardápio sem login, Fechado no momento, pedido no Delivery da loja");
}

(async () => {
  const browser = await chromium.launch();
  try {
    await teste(browser);
    await testePedidoTrancado(browser);
    console.log("E2E PASSOU");
  } catch (e) {
    console.error("E2E FALHOU:", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
