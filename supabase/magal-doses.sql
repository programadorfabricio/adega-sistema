-- ============================================================
-- ADEGA DO MAGAL — configura dose do copão, combos e fardos
--
-- ANTES: rode supabase/fracionado.sql e supabase/fracionado-unidades.sql (uma vez cada).
-- COMO USAR: troque só os números da PARTE 1 com o que o Magal passar e rode tudo.
-- Pode rodar de novo quantas vezes quiser (ele refaz as receitas, não duplica).
-- ============================================================

-- PARTE 1 — PREENCHA AQUI ------------------------------------
drop table if exists cfg, garrafas, fardos, receitas;
create temp table cfg (chave text primary key, valor numeric);
insert into cfg values
  ('dose_copao_ml',        150),   -- ml de bebida em cada copão
  ('energetico_copao_ml',  350),   -- copo de 700 ml − 150 bebida − 200 gelo = 350 ml de energético
  ('garrafa_energetico_ml',2000),  -- tamanho do Energético 2L
  ('garrafa_padrao_ml',    1000);  -- tamanho das garrafas (1000 = 1 L, 750 = 750 ml)

-- Tamanho de cada garrafa: deixe NULL pra usar o padrão acima, ou coloque 750 / 1000
create temp table garrafas (nome text, ml numeric);
insert into garrafas values
  ('Whisky Black Blend garrafa',    null),
  ('Whisky Passaporte garrafa',     null),
  ('Whisky Cavalo Branco garrafa',  null),
  ('Whisky Red Label garrafa',      null),
  ('Whisky Jack Daniel''s garrafa', null),
  ('Gin QN garrafa',                null),
  ('Gin Beefeater garrafa',         null),
  ('Vodka Smirnoff garrafa',        null),
  ('Vodka Absolut garrafa',         null),
  ('Vodka Cîroc garrafa',           null),
  ('Licor 43 garrafa',              null),
  ('Energético 2L',                 2000);

-- Latas em cada fardo: confira com o Magal (os "c/12", "c/15", "c/18" já vêm certos)
create temp table fardos (fardo text, lata text, latas int);
insert into fardos values
  ('Fardo Crystal',            'Crystal lata',            12),
  ('Fardo Itaipava',           'Itaipava lata',           12),
  ('Fardo Petra',              'Petra lata',              12),
  ('Fardo Império c/15',       'Império lata',            15),
  ('Fardo Skol c/12',          'Skol lata',               12),
  ('Fardo Brahma c/12',        'Brahma lata',             12),
  ('Fardo Antártica c/12',     'Antártica lata',          12),
  ('Fardo Amstel',             'Amstel lata',             12),
  ('Fardo Budweiser',          'Budweiser lata',          12),
  ('Fardo Brahma Duplo Malte', 'Brahma Duplo Malte lata', 12),
  ('Fardo Spaten',             'Spaten lata',             12),
  ('Fardo Heineken',           'Heineken lata',           12),
  ('Fardo Original',           'Original lata',           12),
  ('Fardo Heineken Ultimate',  'Heineken Ultimate lata',  12);

-- Copão / combo  →  garrafa usada  (+ energético 2L? + Red Bull?)
create temp table receitas (produto text, garrafa text, dose text, com_energetico boolean, red_bull int);
insert into receitas values
  -- dose: 'copao' = dose do copão  |  'garrafa' = garrafa inteira (combo)
  ('Copão Black Blend',               'Whisky Black Blend garrafa',    'copao',   true,  0),
  ('Copão Passaporte',                'Whisky Passaporte garrafa',     'copao',   true,  0),
  ('Copão Passaporte sabores',        'Whisky Passaporte garrafa',     'copao',   true,  0),
  ('Copão Cavalo Branco',             'Whisky Cavalo Branco garrafa',  'copao',   true,  0),
  ('Copão Red Label',                 'Whisky Red Label garrafa',      'copao',   true,  0),
  ('Copão Jack Daniel''s',            'Whisky Jack Daniel''s garrafa', 'copao',   true,  0),
  ('Copão Gin QN',                    'Gin QN garrafa',                'copao',   true,  0),
  ('Copão Gin Beefeater',             'Gin Beefeater garrafa',         'copao',   true,  0),
  ('Copão Smirnoff',                  'Vodka Smirnoff garrafa',        'copao',   true,  0),
  ('Copão Absolut',                   'Vodka Absolut garrafa',         'copao',   true,  0),
  ('Copão Cîroc c/ Red Bull',         'Vodka Cîroc garrafa',           'copao',   false, 1),
  ('Copão Licor 43 c/ Red Bull',      'Licor 43 garrafa',              'copao',   false, 1),
  ('Combo Black Blend',               'Whisky Black Blend garrafa',    'garrafa', false, 0),
  ('Combo Passaporte',                'Whisky Passaporte garrafa',     'garrafa', false, 0),
  ('Combo Cavalo Branco',             'Whisky Cavalo Branco garrafa',  'garrafa', false, 0),
  ('Combo Red Label + Red Bull',      'Whisky Red Label garrafa',      'garrafa', false, 4),
  ('Combo Jack Daniel''s + Red Bull', 'Whisky Jack Daniel''s garrafa', 'garrafa', false, 4),
  ('Combo Gin QN',                    'Gin QN garrafa',                'garrafa', false, 0),
  ('Combo Beefeater + Red Bull',      'Gin Beefeater garrafa',         'garrafa', false, 4),
  ('Combo Smirnoff',                  'Vodka Smirnoff garrafa',        'garrafa', false, 0),
  ('Combo Absolut + Red Bull',        'Vodka Absolut garrafa',         'garrafa', false, 4),
  ('Combo Cîroc + Red Bull',          'Vodka Cîroc garrafa',           'garrafa', false, 4),
  ('Combo Licor 43 + Red Bull',       'Licor 43 garrafa',              'garrafa', false, 4);
-- Combos "+ Red Bull" levam 4 latas (confirmado pelo Magal).

-- PARTE 2 — NÃO PRECISA MEXER ---------------------------------
-- Garrafas: volume em ml
update magal.produtos p
set volume_ml = coalesce(g.ml, (select valor from cfg where chave = 'garrafa_padrao_ml'))::int,
    fracao_unidade = 'ml'
from garrafas g where p.nome = g.nome and p.ativo;

-- Fardos: quantas latas
update magal.produtos p set volume_ml = f.latas, fracao_unidade = 'un'
from fardos f where p.nome = f.fardo and p.ativo;

-- Latas avulsas passam a baixar do fardo (a lata em si não controla mais estoque)
update magal.produtos p set controla_estoque = false
from fardos f where p.nome = f.lata and p.ativo;

delete from magal.produto_insumos pi using magal.produtos p, fardos f
where pi.produto_id = p.id and p.nome = f.lata;
insert into magal.produto_insumos (produto_id, insumo_id, quantidade)
select l.id, fd.id, 1 from fardos f
join magal.produtos l on l.nome = f.lata and l.ativo
join magal.produtos fd on fd.nome = f.fardo and fd.ativo;

-- Copões e combos: refaz as receitas
delete from magal.produto_insumos pi using magal.produtos p, receitas r
where pi.produto_id = p.id and p.nome = r.produto;

insert into magal.produto_insumos (produto_id, insumo_id, quantidade)
select c.id, g.id,
       case when r.dose = 'garrafa' then g.volume_ml else (select valor from cfg where chave = 'dose_copao_ml') end
from receitas r
join magal.produtos c on c.nome = r.produto and c.ativo
join magal.produtos g on g.nome = r.garrafa and g.ativo;

insert into magal.produto_insumos (produto_id, insumo_id, quantidade)
select c.id, e.id, (select valor from cfg where chave = 'energetico_copao_ml')
from receitas r
join magal.produtos c on c.nome = r.produto and c.ativo
join magal.produtos e on e.nome = 'Energético 2L' and e.ativo
where r.com_energetico;

insert into magal.produto_insumos (produto_id, insumo_id, quantidade)
select c.id, rb.id, r.red_bull
from receitas r
join magal.produtos c on c.nome = r.produto and c.ativo
join magal.produtos rb on rb.nome = 'Red Bull' and rb.ativo
where r.red_bull > 0;

-- Adicional Red Bull/Monster no copão (R$ 10): baixa 1 Red Bull
delete from magal.produto_insumos pi using magal.produtos p
where pi.produto_id = p.id and p.nome = 'Adicional Red Bull/Monster no copão';
insert into magal.produto_insumos (produto_id, insumo_id, quantidade)
select a.id, rb.id, 1 from magal.produtos a join magal.produtos rb on rb.nome = 'Red Bull' and rb.ativo
where a.nome = 'Adicional Red Bull/Monster no copão' and a.ativo;

-- Conferência: cada copão/combo/lata com o que ele desconta
select c.nome as vende, i.nome as desconta_de, pi.quantidade, case when i.volume_ml is null then 'un' else i.fracao_unidade end as unidade
from magal.produto_insumos pi
join magal.produtos c on c.id = pi.produto_id
join magal.produtos i on i.id = pi.insumo_id
order by c.nome, i.nome;
