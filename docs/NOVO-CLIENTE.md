# Cliente novo do Adega FH — passo a passo

Siga em ordem. Tudo que o sistema tem hoje entra automático pelo `nova-adega.sql`:
tabelas, permissões, tempo real, mensalidade (30 dias), pedido online (instalado, desligado)
e a trava do banco (a adega nova já nasce **trancada**: só a conta da loja dela lê e grava).
Toda melhoria nova que precisar de banco deve ser colocada no `nova-adega.sql` também,
pra este passo a passo continuar valendo.

Exemplo usado abaixo: cliente **Adega Premier**, schema **`premier`**.

---

## 1. Pegar com o cliente (antes de configurar)

- [ ] Nome da adega como vai aparecer no sistema
- [ ] Logo (PNG, de preferência fundo transparente)
- [ ] Lista de produtos: nome, preço de venda, custo e categoria (foto da tabela serve)
- [ ] Copões e drinks: o que vai em cada um (ex.: 200 ml de vodka + 1 energético)
- [ ] Bairros que entrega e a taxa de cada um
- [ ] Nome de quem vai usar o caixa
- [ ] Preferências de tela: claro/escuro, letra maior, horário nos itens da comanda, carrinho largo
- [ ] Dia do vencimento e valor da mensalidade

## 2. Supabase (5 min)

0. **Só na primeira vez no projeto:** rode uma vez `supabase/pedido-online.sql` e `supabase/trava.sql`
   do jeito que estão (sem trocar nada), deixe **Authentication → Sign In / Providers → "Allow new
   users to sign up" DESLIGADO** e confira que o app novo (com a tela da conta da loja) já está
   publicado. Com o `trava.sql` instalado, o `nova-adega.sql` cria a adega **já trancada**: o app
   antigo não abriria nela. Se já fez isso numa adega anterior, pule.
   (Detalhes em [MIGRAR-CLIENTE-SEGURANCA.md](MIGRAR-CLIENTE-SEGURANCA.md), passos 1 e 2.)
1. **SQL Editor → aba nova:** cole `supabase/nova-adega.sql`, troque `'magal'` por `'premier'` e rode.
   No fim aparece *"Adega premier criada"*. Se aparecer *"Trava do banco não instalada"*, faça o
   item 0 e rode o `nova-adega.sql` de novo.
   **O schema `premier` já existia** (criado antes do `trava.sql` existir)? Ele está aberto e sem a
   conferência do PIN: com `NEXT_PUBLIC_LOGIN_LOJA=1` todo PIN daria errado. Rode o `nova-adega.sql`
   de novo (é seguro) ou o `supabase/trava.sql` com `alvo = 'premier'`.
   **Confira antes de seguir** (tem que dar `1`):
   ```sql
   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'premier' and p.proname = 'conferir_pin';
   ```
2. **Project Settings → Data API → Exposed schemas:** adicione `premier` e salve.
3. **Mensalidade** (ajuste data, valor e Pix):
   ```sql
   update premier.assinatura
      set vencimento = '2026-12-10', valor = 129.00, pix = 'SUA_CHAVE_PIX', updated_at = now();
   ```
4. **Conta da loja** (é com ela que cada aparelho da adega entra; sem ela o app não abre):
   - **Authentication → Users → Add user → Create new user:** e-mail só da loja
     (ex.: `loja.premier@seudominio.com`), uma senha forte (anote) e marque **"Auto Confirm User"**.
   - **SQL Editor:** ligue a conta à adega:
     ```sql
     update auth.users set raw_app_meta_data = raw_app_meta_data || '{"schema":"premier"}' where email = 'loja.premier@seudominio.com';
     ```
     Tem que aparecer *"1 row"*.

## 3. Logo

Salve como `public/logos/premier.png` no repositório (ou mande pro Claude colocar e subir).
Pra virar ícone do app instalado, gere também `public/icons/premier-192.png`, `premier-512.png` e `premier-apple.png`
(logo centralizada num quadrado, 80% do tamanho). Sem eles o app usa o ícone padrão FH.

## 4. Vercel (5 min)

**Add New → Project →** importe `adega-sistema` (branch `main`). Antes do Deploy, em **Environment Variables**:

| Variável | Valor | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | mesma das outras adegas | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mesma das outras adegas | ✅ |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | `premier` | ✅ |
| `NEXT_PUBLIC_NOME_ADEGA` | `Adega Premier` | ✅ |
| `NEXT_PUBLIC_LOGIN_LOJA` | `1` = tela "Entrar com a conta da loja" (a adega nova nasce trancada: sem isso não abre) | ✅ |
| `NEXT_PUBLIC_TEMA` | `claro` (padrão: escuro) | opcional |
| `NEXT_PUBLIC_ESCALA` | `1.15` = letras maiores (0.8 a 1.5) | opcional |
| `NEXT_PUBLIC_HORARIOS` | `1` = hora em cada item da comanda | opcional |
| `NEXT_PUBLIC_CARRINHO_LARGO` | `1` = carrinho da Venda Rápida maior | opcional |
| `NEXT_PUBLIC_COR_DESTAQUE` | ex. `#d97706` | opcional |
| `NEXT_PUBLIC_EMOJI` | emoji no lugar da logo | opcional |
| `NEXT_PUBLIC_OCULTAR_PAGINAS` | ex. `comandas,compras` | opcional |
| `NEXT_PUBLIC_PEDIDO_ONLINE` | `1` = cardápio online `/pedir` (só se contratou) | opcional |
| `NEXT_PUBLIC_VENDER_SEM_ESTOQUE` | `1` = deixa vender com estoque 0 (só na implantação, enquanto contam; apague depois) | opcional |

Todas são do tipo **Config** (nenhuma é segredo). Depois clique **Deploy**.
Mudou alguma variável depois? **Deployments → ⋯ → Redeploy**, senão não vale.

Use sempre o endereço principal do projeto (`<projeto>.vercel.app`), nunca o endereço com letras
no meio (`<projeto>-abc123-...vercel.app`): esse é uma cópia fixa de um deploy antigo.

## 5. Cadastro (antes do dia da implantação)

Mande pro Claude a lista de produtos, receitas, bairros e usuários do passo 1: ele monta o SQL e
deixa tudo cadastrado no schema `premier`. No dia, só falta contar o estoque.

## 6. No dia da implantação

- [ ] Em **cada** aparelho (celular, tablet, computador do caixa): abrir o sistema → **"Entrar com a
      conta da loja"** → e-mail e senha da loja do passo 2.4. O aparelho fica lembrado.
- [ ] Lançar a quantidade de cada produto (Estoque → Entrada)
- [ ] Trocar o PIN do Admin (Configurações → Usuários) — o cliente escolhe
- [ ] Criar o usuário de cada pessoa do caixa, com PIN próprio
- [ ] Preencher Configurações → dados da loja (nome, WhatsApp, endereço)
- [ ] Venda teste: Venda Rápida, uma comanda e (se usa) um delivery
- [ ] Abrir e fechar um caixa de teste
- [ ] Se tem pedido online: copiar o link em Delivery → 🔔 Pedidos online e fazer um pedido pelo celular
- [ ] Mandar o guia "Como usar o Adega FH" pro cliente
- [ ] Mostrar pro dono: aparelho vendido/perdido → entrar como admin → **Configurações → 🚪 Sair da
      conta da loja** naquele aparelho (os outros continuam conectados)

## 7. Já está automático (não precisa fazer nada)

- **Banco trancado:** só a conta da loja desta adega lê e grava. Se um dia rodar outro script de banco
  nela (`caixa.sql`, `compras.sql`, `delivery.sql` etc.), rode o `supabase/trava.sql` de novo com
  `alvo = 'premier'`. Se algo parar de funcionar: `supabase/destrancar-adega.sql` com `'premier'`.
- **Backup:** o repositório `backup-fh` copia o banco inteiro toda madrugada (03:17) e já inclui o schema novo.
- **Telas atualizando sozinhas:** tempo real + recarga a cada 30 s.
- **Aviso de mensalidade:** faixa amarela 5 dias antes, vermelha no vencimento, bloqueio 5 dias depois.

## Dia a dia da mensalidade

```sql
-- Cliente pagou → empurra 1 mês
update premier.assinatura set vencimento = vencimento + interval '1 month', updated_at = now();
-- Liberar na hora
update premier.assinatura set vencimento = current_date + 30, updated_at = now();
```
