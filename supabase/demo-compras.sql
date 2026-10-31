-- ============================================================
-- DADOS DE DEMONSTRAÇÃO: fornecedores, compras e custo dos produtos
--
-- Só nas demos: public (Império Bebidas), demogas e demotabacaria.
-- NÃO roda em loja de cliente. Pode rodar de novo sem duplicar: rodar de novo
-- (ex.: no dia de uma demonstração) só traz as datas das compras pro mês atual.
-- Precisa do compras.sql e do custo-lucro.sql já rodados.
-- Fornecedores e telefones são inventados.
-- ============================================================

-- ─── 1. ADEGA (public) ───────────────────────────────────────

insert into public.categorias (nome)
select c from unnest(array['cervejas','destilados','energéticos','gelo e carvão','descartáveis']) as c
where not exists (select 1 from public.categorias x where x.nome = c);

insert into public.produtos (nome, categoria, preco, preco_custo, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
select v.nome, v.categoria, v.preco, v.custo, 'un', v.estoque, v.minimo, true, true
from (values
  ('Heineken long neck 330 ml',  'cervejas',       9.00,   5.20, 48, 24),
  ('Brahma lata 350 ml',         'cervejas',       5.00,   3.10, 72, 36),
  ('Skol lata 350 ml',           'cervejas',       4.50,   2.90, 60, 36),
  ('Red Bull 250 ml',            'energéticos',   12.00,   7.00, 24, 12),
  ('Whisky Red Label 1 L',       'destilados',   160.00,  95.00,  6,  2),
  ('Vodka Smirnoff 998 ml',      'destilados',    55.00,  32.00,  8,  3),
  ('Gelo 5 kg',                  'gelo e carvão', 15.00,   6.00, 20,  8),
  ('Carvão 4 kg',                'gelo e carvão', 25.00,  14.00, 10,  4),
  ('Copo descartável 500 ml (50 un)', 'descartáveis', 12.00, 6.50, 15, 5)
) as v(nome, categoria, preco, custo, estoque, minimo)
where not exists (select 1 from public.produtos p where p.nome = v.nome and p.ativo);

-- custo nos produtos que ainda não têm (margem de ~40%), pra tela de lucro aparecer
update public.produtos set preco_custo = round(preco * 0.6, 2)
where preco_custo is null and ativo and controla_estoque is distinct from false and preco > 0;

insert into public.fornecedores (nome, contato, telefone, observacao)
select v.* from (values
  ('Distribuidora Central Bebidas', 'Ricardo', '(19) 90000-0101', 'Cervejas e refrigerantes · entrega terça e sexta · pedido mínimo R$ 500'),
  ('Atacado Destilados Paulista',   'Fernanda', '(19) 90000-0102', 'Whisky, vodka e gin · boleto 28 dias'),
  ('Gelo Polar',                    'Seu Antônio', '(19) 90000-0103', 'Gelo e carvão · entrega todo dia até 17h'),
  ('Embalagens Campinas',           'Lúcia', '(19) 90000-0104', 'Copos, sacolas e descartáveis')
) as v(nome, contato, telefone, observacao)
where not exists (select 1 from public.fornecedores f where f.nome = v.nome);

-- compras: cada uma só entra se ainda não existe compra com a mesma observação
do $$
declare
  r record; cid uuid; d date;
begin
  for r in select * from (values
    ('Distribuidora Central Bebidas', 0.15::numeric, 'paga',    'boleto', null::date, 'NF 10482', array['Heineken long neck 330 ml','Brahma lata 350 ml','Skol lata 350 ml'], array[48,72,60]::numeric[], array[5.20,3.10,2.90]::numeric[]),
    ('Gelo Polar',                    0.3, 'paga',    'pix',    null,       'Pedido semanal', array['Gelo 5 kg','Carvão 4 kg'], array[30,10]::numeric[], array[6.00,14.00]::numeric[]),
    ('Atacado Destilados Paulista',   0.5, 'paga',    'pix',    null,       'NF 7731', array['Whisky Red Label 1 L','Vodka Smirnoff 998 ml'], array[6,8]::numeric[], array[95.00,32.00]::numeric[]),
    ('Embalagens Campinas',           0.75, 'paga',    'dinheiro', null,     'Copos pro fim de semana', array['Copo descartável 500 ml (50 un)'], array[10]::numeric[], array[6.50]::numeric[]),
    ('Distribuidora Central Bebidas', 0.95, 'a_pagar', null,     current_date + 4, 'NF 10611 · boleto', array['Heineken long neck 330 ml','Brahma lata 350 ml','Red Bull 250 ml'], array[48,96,24]::numeric[], array[5.20,3.10,7.00]::numeric[])
  ) as t(forn, frac, status, forma, venc, obs, nomes, qtds, custos)
  loop
    -- data dentro do mês em que o script roda (rodar de novo atualiza as datas da demo)
    d := (date_trunc('month', current_date)::date + floor((extract(day from current_date) - 1) * r.frac)::int);
    if exists (select 1 from public.compras where observacao = r.obs) then
      update public.compras set data = d, vencimento = r.venc, pago_em = case when status = 'paga' then d::timestamptz end where observacao = r.obs;
      continue;
    end if;
    insert into public.compras (fornecedor_id, fornecedor_nome, data, status, forma_pagamento, vencimento, pago_em, observacao)
    select f.id, f.nome, d, r.status, r.forma, r.venc, case when r.status = 'paga' then d::timestamptz end, r.obs
    from public.fornecedores f where f.nome = r.forn
    returning id into cid;
    continue when cid is null;
    insert into public.compra_itens (compra_id, produto_id, nome_produto, quantidade, custo_unitario, subtotal)
    select cid, p.id, p.nome, r.qtds[i], r.custos[i], round(r.qtds[i] * r.custos[i], 2)
    from generate_subscripts(r.nomes, 1) as i
    join public.produtos p on p.nome = r.nomes[i] and p.ativo;
    update public.compras set total = coalesce((select sum(subtotal) from public.compra_itens where compra_id = cid), 0) where id = cid;
  end loop;
end $$;

-- ─── 2. GÁS E ÁGUA (demogas) ─────────────────────────────────

update demogas.produtos set preco_custo = round(preco * 0.78, 2)
where preco_custo is null and ativo and controla_estoque is distinct from false and preco > 0;

insert into demogas.fornecedores (nome, contato, telefone, observacao)
select v.* from (values
  ('Distribuidora de GLP Regional', 'Marcos', '(19) 90000-0201', 'Gás P13 e P45 · carga toda segunda e quinta'),
  ('Água Mineral Serra Azul',       'Patrícia', '(19) 90000-0202', 'Galão 20 L e fardos · boleto 14 dias'),
  ('Acessórios Gás Center',         'Beto', '(19) 90000-0203', 'Reguladores, mangueiras e bombas')
) as v(nome, contato, telefone, observacao)
where not exists (select 1 from demogas.fornecedores f where f.nome = v.nome);

do $$
declare
  r record; cid uuid; d date;
begin
  for r in select * from (values
    ('Distribuidora de GLP Regional', 0.1::numeric, 'paga',    'transferencia', null::date, 'Carga 41', array['Gás P13 (troca)','Gás P45 (troca)'], array[40,4]::numeric[], array[89.70,351.00]::numeric[]),
    ('Água Mineral Serra Azul',       0.4, 'paga',    'pix',    null,      'Pedido 2288', array['Água 20 L (troca)','Água 1,5 L fardo c/6','Água 500 ml'], array[80,20,96]::numeric[], array[10.90,14.00,1.95]::numeric[]),
    ('Acessórios Gás Center',         0.65, 'paga',    'pix',    null,      'Reposição acessórios', array['Regulador de gás','Mangueira de gás 1,25 m'], array[10,12]::numeric[], array[35.00,19.50]::numeric[]),
    ('Distribuidora de GLP Regional', 0.9, 'a_pagar', null,     current_date + 3, 'Carga 44 · boleto', array['Gás P13 (troca)'], array[40]::numeric[], array[89.70]::numeric[])
  ) as t(forn, frac, status, forma, venc, obs, nomes, qtds, custos)
  loop
    -- data dentro do mês em que o script roda (rodar de novo atualiza as datas da demo)
    d := (date_trunc('month', current_date)::date + floor((extract(day from current_date) - 1) * r.frac)::int);
    if exists (select 1 from demogas.compras where observacao = r.obs) then
      update demogas.compras set data = d, vencimento = r.venc, pago_em = case when status = 'paga' then d::timestamptz end where observacao = r.obs;
      continue;
    end if;
    insert into demogas.compras (fornecedor_id, fornecedor_nome, data, status, forma_pagamento, vencimento, pago_em, observacao)
    select f.id, f.nome, d, r.status, r.forma, r.venc, case when r.status = 'paga' then d::timestamptz end, r.obs
    from demogas.fornecedores f where f.nome = r.forn
    returning id into cid;
    continue when cid is null;
    insert into demogas.compra_itens (compra_id, produto_id, nome_produto, quantidade, custo_unitario, subtotal)
    select cid, p.id, p.nome, r.qtds[i], r.custos[i], round(r.qtds[i] * r.custos[i], 2)
    from generate_subscripts(r.nomes, 1) as i
    join demogas.produtos p on p.nome = r.nomes[i] and p.ativo;
    update demogas.compras set total = coalesce((select sum(subtotal) from demogas.compra_itens where compra_id = cid), 0) where id = cid;
  end loop;
end $$;

-- ─── 3. TABACARIA (demotabacaria) ────────────────────────────

update demotabacaria.produtos set preco_custo = round(preco * 0.55, 2)
where preco_custo is null and ativo and controla_estoque is distinct from false and preco > 0;

insert into demotabacaria.fornecedores (nome, contato, telefone, observacao)
select v.* from (values
  ('Essências Brasil Distribuidora', 'Diego', '(19) 90000-0301', 'Essências 50 g e 250 g · pedido mínimo 20 un'),
  ('Coco Carvão Premium',            'Juliana', '(19) 90000-0302', 'Carvão de coco 500 g e 1 kg'),
  ('Headshop Atacado',               'Rafael', '(19) 90000-0303', 'Narguilés, rosh, mangueiras e acessórios')
) as v(nome, contato, telefone, observacao)
where not exists (select 1 from demotabacaria.fornecedores f where f.nome = v.nome);

do $$
declare
  r record; cid uuid; d date;
begin
  for r in select * from (values
    ('Essências Brasil Distribuidora', 0.2::numeric, 'paga',    'pix',    null::date, 'Pedido 551', array['Essência 50 g · Menta','Essência 50 g · Uva','Essência 50 g · Melancia','Essência 50 g · Pêssego'], array[12,12,10,8]::numeric[], array[15.40,15.40,15.40,15.40]::numeric[]),
    ('Coco Carvão Premium',            0.45, 'paga',    'pix',    null,       'Pedido 87', array['Carvão de coco 1 kg','Carvão de coco 500 g'], array[24,20]::numeric[], array[17.60,9.90]::numeric[]),
    ('Headshop Atacado',               0.7, 'paga',    'cartao', null,       'NF 3390', array['Rosh de cerâmica','Mangueira de silicone','Narguilé médio completo'], array[6,8,3]::numeric[], array[19.00,16.50,121.00]::numeric[]),
    ('Essências Brasil Distribuidora', 0.95, 'a_pagar', null,     current_date + 5, 'Pedido 563 · boleto', array['Essência 50 g · Uva','Essência 250 g · Menta'], array[20,4]::numeric[], array[15.40,60.50]::numeric[])
  ) as t(forn, frac, status, forma, venc, obs, nomes, qtds, custos)
  loop
    -- data dentro do mês em que o script roda (rodar de novo atualiza as datas da demo)
    d := (date_trunc('month', current_date)::date + floor((extract(day from current_date) - 1) * r.frac)::int);
    if exists (select 1 from demotabacaria.compras where observacao = r.obs) then
      update demotabacaria.compras set data = d, vencimento = r.venc, pago_em = case when status = 'paga' then d::timestamptz end where observacao = r.obs;
      continue;
    end if;
    insert into demotabacaria.compras (fornecedor_id, fornecedor_nome, data, status, forma_pagamento, vencimento, pago_em, observacao)
    select f.id, f.nome, d, r.status, r.forma, r.venc, case when r.status = 'paga' then d::timestamptz end, r.obs
    from demotabacaria.fornecedores f where f.nome = r.forn
    returning id into cid;
    continue when cid is null;
    insert into demotabacaria.compra_itens (compra_id, produto_id, nome_produto, quantidade, custo_unitario, subtotal)
    select cid, p.id, p.nome, r.qtds[i], r.custos[i], round(r.qtds[i] * r.custos[i], 2)
    from generate_subscripts(r.nomes, 1) as i
    join demotabacaria.produtos p on p.nome = r.nomes[i] and p.ativo;
    update demotabacaria.compras set total = coalesce((select sum(subtotal) from demotabacaria.compra_itens where compra_id = cid), 0) where id = cid;
  end loop;
end $$;

-- ─── Conferência ─────────────────────────────────────────────
select 'adega' as demo, (select count(*) from public.fornecedores) as fornecedores, (select count(*) from public.compras) as compras,
       (select count(*) from public.produtos where ativo and preco_custo is not null) as produtos_com_custo
union all
select 'gás', (select count(*) from demogas.fornecedores), (select count(*) from demogas.compras),
       (select count(*) from demogas.produtos where ativo and preco_custo is not null)
union all
select 'tabacaria', (select count(*) from demotabacaria.fornecedores), (select count(*) from demotabacaria.compras),
       (select count(*) from demotabacaria.produtos where ativo and preco_custo is not null);
