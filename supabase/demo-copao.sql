-- ============================================================
-- DEMONSTRAÇÃO: copões com receita na Império Bebidas (schema public)
--
-- • Vodka Smirnoff e Red Label passam a vender em dose (garrafa em ml)
-- • Cria "Copão Vodka + Red Bull" (R$ 30) e "Copão Red Label + Red Bull" (R$ 40)
--   sem estoque próprio: cada venda baixa 200 ml da garrafa + 1 Red Bull
-- Rode no SQL Editor (aba nova). Pode rodar de novo sem duplicar.
-- ============================================================

insert into public.categorias (nome)
select 'copão' where not exists (select 1 from public.categorias where nome = 'copão');

-- Garrafas vendidas em dose
update public.produtos set volume_ml = 998,  fracao_unidade = 'ml' where nome = 'Vodka Smirnoff 998 ml' and ativo;
update public.produtos set volume_ml = 1000, fracao_unidade = 'ml' where nome = 'Whisky Red Label 1 L' and ativo;

do $$
declare
  vodka   public.produtos.id%type;
  whisky  public.produtos.id%type;
  redbull public.produtos.id%type;
  c1      public.produtos.id%type;
  c2      public.produtos.id%type;
begin
  select id into vodka   from public.produtos where nome = 'Vodka Smirnoff 998 ml' and ativo limit 1;
  select id into whisky  from public.produtos where nome = 'Whisky Red Label 1 L'  and ativo limit 1;
  select id into redbull from public.produtos where nome = 'Red Bull 250 ml'       and ativo limit 1;
  if vodka is null or whisky is null or redbull is null then
    raise exception 'Rode antes o demo-compras.sql (faltam Vodka, Red Label ou Red Bull)';
  end if;

  select id into c1 from public.produtos where nome = 'Copão Vodka + Red Bull' and ativo limit 1;
  if c1 is null then
    insert into public.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
    values ('Copão Vodka + Red Bull', 'copão', 30.00, 'un', 0, 0, false, true) returning id into c1;
  end if;

  select id into c2 from public.produtos where nome = 'Copão Red Label + Red Bull' and ativo limit 1;
  if c2 is null then
    insert into public.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque, ativo)
    values ('Copão Red Label + Red Bull', 'copão', 40.00, 'un', 0, 0, false, true) returning id into c2;
  end if;

  -- Receitas (200 ml da garrafa + 1 Red Bull)
  insert into public.produto_insumos (produto_id, insumo_id, quantidade) values
    (c1, vodka, 200), (c1, redbull, 1),
    (c2, whisky, 200), (c2, redbull, 1)
  on conflict (produto_id, insumo_id) do update set quantidade = excluded.quantidade;
end $$;

-- Conferência: cada copão com a receita e o custo calculado
select c.nome as copao, c.preco, i.nome as vai_no_copao, r.quantidade,
       round(case when i.volume_ml > 0 then i.preco_custo / i.volume_ml * r.quantidade
                  else i.preco_custo * r.quantidade end, 2) as custo
from public.produtos c
join public.produto_insumos r on r.produto_id = c.id
join public.produtos i on i.id = r.insumo_id
where c.categoria = 'copão'
order by c.nome, i.nome;
