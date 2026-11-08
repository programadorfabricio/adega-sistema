# Segurança: ligar o login da loja e trancar o banco (adega que já existe)

**O que muda:** hoje qualquer pessoa com o endereço do Supabase consegue ler e mexer no banco de
qualquer adega. Depois deste passo a passo:

- cada aparelho da adega entra **uma vez** com o e-mail e a senha da loja (a "conta da loja");
  depois disso continua entrando só com o PIN, como hoje;
- o banco de cada adega fica **trancado**: só a conta daquela adega lê e grava nele;
- o PIN é conferido no banco (5 PINs errados = bloqueado por 5 minutos);
- o cardápio online (`/pedir`) continua funcionando sem login para o cliente final.

Exemplo usado abaixo: cliente **Adega do Magal**, schema **`magal`**.
Troque `magal` pelo schema do cliente em todos os comandos.

> Regra de ouro: **só tranque depois que o cliente já entrou com a conta da loja em todos os aparelhos.**
> Se trancar antes, o app para de carregar naquela adega. Se der problema em qualquer momento,
> veja "Deu problema? Destrancar" no fim.

---

## Passo 1 — Uma vez só, no projeto do Supabase (antes de subir o app novo)

Faça isso **uma única vez** (vale para todas as adegas do projeto).

1. **Supabase → Authentication → Sign In / Providers → Email:** deixe **"Allow new users to sign up"
   DESLIGADO** e salve. Assim ninguém cria conta sozinho: só você cria, pelo painel.
   (O provedor "Email" em si continua ligado.)
2. **SQL Editor → aba nova:** cole o `supabase/pedido-online.sql` inteiro e rode **do jeito que está**
   (instala o cardápio novo na demonstração, `public`).
   Depois, **para cada adega que já existe** (ex.: `magal`) **e cada demonstração que usa o cardápio
   online** (ex.: `demotabacaria`, `demogas`), rode o mesmo arquivo de novo trocando `'public'` na
   linha `alvo` pelo schema dela. Isso instala a função `cardapio_online`, que o `/pedir` novo usa.
   Pode rodar mais de uma vez sem erro. Para ver a lista de todos os schemas que precisam, rode:
   ```sql
   select table_schema from information_schema.tables where table_name = 'configuracoes' order by 1;
   ```
3. **SQL Editor → aba nova:** cole o `supabase/trava.sql` inteiro e rode **do jeito que está**, sem
   trocar `NOME_DA_ADEGA`. Ele só instala as funções (login, PIN, ping, trancar, destrancar) e
   **não tranca nenhuma adega**. No fim aparece o aviso:
   *"Funções instaladas. Nenhuma adega foi trancada…"* — é isso mesmo, está certo.

## Passo 2 — Subir o app novo

Faça o merge da branch `seguranca` na `main` (ou peça pro Claude). A Vercel publica sozinha em todas
as adegas. Enquanto a variável `NEXT_PUBLIC_LOGIN_LOJA` não estiver ligada numa adega, ela continua
funcionando exatamente como hoje (sem conta da loja).

## Passo 3 — Para cada cliente (ex.: Magal), um de cada vez

### 3.1 Criar a conta da loja

1. **Supabase → Authentication → Users → Add user → Create new user.**
   - E-mail: um e-mail só da loja (ex.: `loja.magal@seudominio.com`; não precisa existir caixa de
     entrada, mas guarde bem).
   - Senha: uma senha forte. Anote — o cliente vai precisar dela em cada aparelho.
     O dono deve **guardar essa senha à mão** (ex.: anotada no caixa ou no celular dele): a tela
     "Entrar com a conta da loja" pode voltar sozinha num aparelho (ex.: ficou dias sem internet e o
     acesso venceu, ou deu erro definitivo ao renovar o acesso) e aí precisa digitar de novo.
   - Marque **"Auto Confirm User"**.
2. **SQL Editor:** ligue a conta à adega (troque o schema e o e-mail):
   ```sql
   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"schema":"magal"}' where email = 'loja.magal@seudominio.com';
   ```
   Tem que aparecer *"1 row"*. Se aparecer *0*, o e-mail está diferente do que você criou.
3. **SQL Editor:** prepare o login da loja **sem trancar** (o banco continua aberto, nada para):
   ```sql
   select public.preparar_login('magal');
   ```

### 3.2 Ligar a tela da conta da loja

> **Atenção:** assim que o Redeploy terminar, **todos** os aparelhos da adega passam a mostrar
> "Entrar com a conta da loja" (mesmo com o banco ainda aberto) e ninguém usa o sistema até entrar.
> Por isso, **antes** do Redeploy:
> - mande pro dono o e-mail e a senha da loja (do passo 3.1);
> - combine um horário com a adega fechada ou parada e o dono disponível (em ligação com você);
> - logo depois do Redeploy, ele entra com a conta em cada aparelho (passo 3.3).

1. **Vercel → projeto da adega → Settings → Environment Variables:** adicione
   `NEXT_PUBLIC_LOGIN_LOJA` = `1`.
2. **Deployments → ⋯ → Redeploy** (sem isso a variável não vale).

### 3.3 O cliente entra com a conta em cada aparelho

Em **cada** celular/tablet/computador da adega: abra o sistema → aparece
**"Entrar com a conta da loja"** → digite o e-mail e a senha da loja → **Entrar**.
Depois aparece a lista de usuários de sempre e entra com o PIN.
O aparelho fica lembrado: não precisa digitar o e-mail de novo amanhã.

Confira que **todos** os aparelhos já passaram por isso antes de seguir. Cliente longe (atendimento
remoto)? Pergunte ao dono quantos aparelhos usam o sistema e peça uma foto da tela do PIN ("Quem está
acessando?") em cada um deles.

### 3.4 Trancar o banco da adega

**SQL Editor:** cole o `supabase/trava.sql` inteiro, troque `'NOME_DA_ADEGA'` (linha `alvo`, lá
embaixo) por `'magal'` e rode. Pode rodar de novo sem erro.

### 3.5 Venda teste (logo depois de trancar)

- [ ] Venda Rápida: uma venda
- [ ] Comanda: abrir, lançar e remover um item (pede PIN)
- [ ] Delivery e Caixa: abrir e fechar um caixa de teste
- [ ] Se usa pedido online: fazer um pedido pelo celular em `/pedir` (sem login) e ver chegar em
      **Delivery → 🔔 Pedidos online**
- [ ] Tempo real: com dois aparelhos abertos, mude algo num deles (ex.: uma venda ou um item na
      comanda) e veja aparecer no outro em segundos. Se demorar até 30 s, é a recarga automática que
      está cobrindo e o tempo real não está chegando — avise o Fabrício.

Tudo certo? Pronto, essa adega está protegida.

---

## Deu problema? Destrancar

**SQL Editor:** cole o `supabase/destrancar-adega.sql`, troque `'NOME_DA_ADEGA'` por `'magal'` e rode.
O banco volta a ficar aberto como antes e os aparelhos **que já entraram com a conta da loja** voltam a
funcionar na hora.

Algum aparelho preso na tela "Entrar com a conta da loja" (ex.: perdeu a senha)? Aí, **nesta ordem**:
1. primeiro o `destrancar-adega.sql` acima;
2. depois apague `NEXT_PUBLIC_LOGIN_LOJA` na Vercel e faça **Redeploy** (volta a tela antiga, sem conta da loja).

**Nunca apague a variável com o banco ainda trancado**: o app volta a entrar sem conta da loja, o banco
trancado não deixa e o sistema para de carregar.

**Nunca volte o deploy** (Instant Rollback da Vercel, "Promote" de um deploy antigo ou voltar a `main`
para antes da segurança) **com uma adega trancada**: a versão antiga não tem a conta da loja e para de
carregar nela. Destranque antes (todas as adegas trancadas daquele deploy) e só depois volte.

Depois descubra o que faltou (normalmente: algum aparelho que não entrou com a conta da loja) e refaça
a partir do passo 3.2 (ou 3.4, se a variável continua ligada).

## Depois de trancada: cuidados

- **Rodou algum script antigo de banco numa adega trancada?** (`caixa.sql`, `compras.sql`,
  `delivery.sql`, `fracionado.sql`, `pedido-online.sql`, `mensalidade.sql`, `demo-*.sql` etc.)
  Rode o `supabase/trava.sql` de novo com `alvo` = schema dessa adega. Tabela nova criada depois de
  trancar nasce fechada e só passa a funcionar no app depois disso.
- **Aparelho novo na adega / cliente trocou de celular:** entra com o e-mail e a senha da loja uma vez.
- **Sair da conta num aparelho** (ex.: aparelho vendido): entre como admin →
  **Configurações → 🚪 Sair da conta da loja**. Os outros aparelhos continuam conectados.
- **Trocar a senha da loja:** Supabase → Authentication → Users → a conta → trocar a senha.
  A senha nova vale para os próximos logins; um aparelho que já estava conectado pode continuar
  conectado (para tirar um aparelho, use "Sair da conta da loja" nele).
- **A demonstração (`public`) nunca é trancada.** Se quiser testar a tela da conta da loja na demo,
  rode `select public.preparar_login('public');` e crie uma conta com `{"schema":"public"}`.
