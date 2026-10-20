-- ============================================================
-- ADEGA DO MAGAL — produtos do cardápio (out/2026)
-- Rode no SQL Editor do Supabase. Pode rodar de novo: não duplica.
-- ============================================================

-- 1. Produtos que não controlam estoque (copão, drinks, combos)
alter table public.produtos add column if not exists controla_estoque boolean not null default true;
alter table magal.produtos  add column if not exists controla_estoque boolean not null default true;

-- 2. Categoria nova
insert into magal.categorias (nome)
select 'combos' where not exists (select 1 from magal.categorias where nome = 'combos');

-- 3. Produtos  (nome, categoria, preço, unidade, estoque mínimo, controla estoque)
insert into magal.produtos (nome, categoria, preco, unidade, estoque_atual, estoque_minimo, controla_estoque)
select v.nome, v.categoria, v.preco, v.unidade, 0, v.minimo, v.controla
from (values
  -- Cervejas: latas
  ('Crystal lata',               'cervejas',  4.00, 'un', 12, true),
  ('Itaipava lata',              'cervejas',  5.00, 'un', 12, true),
  ('Império lata',               'cervejas',  5.00, 'un', 12, true),
  ('Petra lata',                 'cervejas',  5.00, 'un', 12, true),
  ('Antártica lata',             'cervejas',  5.00, 'un', 12, true),
  ('Skol lata',                  'cervejas',  5.00, 'un', 12, true),
  ('Brahma lata',                'cervejas',  5.00, 'un', 12, true),
  ('Amstel lata',                'cervejas',  6.00, 'un', 12, true),
  ('Budweiser lata',             'cervejas',  6.00, 'un', 12, true),
  ('Brahma Duplo Malte lata',    'cervejas',  6.00, 'un', 12, true),
  ('Spaten lata',                'cervejas',  6.00, 'un', 12, true),
  ('Heineken lata',              'cervejas',  7.00, 'un', 12, true),
  ('Heineken Zero lata',         'cervejas',  7.00, 'un', 6,  true),
  ('Original lata',              'cervejas',  7.00, 'un', 12, true),
  -- Cervejas: fardos
  ('Fardo Crystal',              'cervejas', 40.00, 'fardo', 2, true),
  ('Fardo Itaipava',             'cervejas', 45.00, 'fardo', 2, true),
  ('Fardo Petra',                'cervejas', 45.00, 'fardo', 2, true),
  ('Fardo Império c/15',         'cervejas', 50.00, 'fardo', 2, true),
  ('Fardo Skol c/12',            'cervejas', 50.00, 'fardo', 2, true),
  ('Fardo Brahma c/12',          'cervejas', 50.00, 'fardo', 2, true),
  ('Fardo Antártica c/12',       'cervejas', 50.00, 'fardo', 2, true),
  ('Fardo Amstel',               'cervejas', 50.00, 'fardo', 2, true),
  ('Fardo Budweiser',            'cervejas', 50.00, 'fardo', 2, true),
  ('Fardo Skol c/18',            'cervejas', 70.00, 'fardo', 2, true),
  ('Fardo Brahma c/18',          'cervejas', 70.00, 'fardo', 2, true),
  ('Fardo Antártica c/18',       'cervejas', 70.00, 'fardo', 2, true),
  ('Fardo Brahma Duplo Malte',   'cervejas', 60.00, 'fardo', 2, true),
  ('Fardo Spaten',               'cervejas', 60.00, 'fardo', 2, true),
  ('Fardo Heineken',             'cervejas', 78.00, 'fardo', 2, true),
  ('Fardo Original',             'cervejas', 65.00, 'fardo', 2, true),
  -- Cervejas: long neck
  ('Amstel long neck',           'cervejas',  8.00, 'un', 6, true),
  ('Budweiser long neck',        'cervejas',  8.00, 'un', 6, true),
  ('Heineken long neck',         'cervejas', 10.00, 'un', 6, true),
  ('Corona long neck',           'cervejas', 12.00, 'un', 6, true),
  ('Smirnoff Ice long neck',     'cervejas', 12.00, 'un', 6, true),
  -- Cervejas: gorduchinha 300 ml
  ('Brahma 300ml',               'cervejas',  4.50, 'un', 6, true),
  ('Skol 300ml',                 'cervejas',  4.50, 'un', 6, true),
  ('Antártica 300ml',            'cervejas',  4.50, 'un', 6, true),
  ('Original 300ml',             'cervejas',  5.00, 'un', 6, true),
  -- Cervejas: 600 ml
  ('Brahma 600ml',               'cervejas',  8.00, 'un', 6, true),
  ('Skol 600ml',                 'cervejas',  8.00, 'un', 6, true),
  ('Antártica 600ml',            'cervejas',  8.00, 'un', 6, true),
  ('Original 600ml',             'cervejas', 10.00, 'un', 6, true),
  ('Amstel 600ml',               'cervejas', 10.00, 'un', 6, true),
  ('Heineken 600ml',             'cervejas', 12.00, 'un', 6, true),
  -- Energéticos
  ('Energético 2L',              'energéticos', 10.00, 'un', 4, true),
  ('Red Bull',                   'energéticos', 12.00, 'un', 6, true),
  ('Monster',                    'energéticos', 12.00, 'un', 6, true),
  ('Bally',                      'energéticos', 15.00, 'un', 4, true),
  -- Refrigerantes e sucos
  ('Água 510ml',                 'refrigerantes',  2.00, 'un', 6, true),
  ('Coca-Cola garrafinha',       'refrigerantes',  3.50, 'un', 6, true),
  ('Tampico 450ml',              'refrigerantes',  5.00, 'un', 4, true),
  ('Refrigerante lata',          'refrigerantes',  6.00, 'un', 6, true),
  ('Itubaína',                   'refrigerantes',  8.00, 'un', 4, true),
  ('Fanta 2L',                   'refrigerantes', 13.00, 'un', 3, true),
  ('Sprite 2L',                  'refrigerantes', 13.00, 'un', 3, true),
  ('Coca-Cola 2L',               'refrigerantes', 15.00, 'un', 3, true),
  ('Coca-Cola Zero 2L',          'refrigerantes', 15.00, 'un', 3, true),
  -- Gelo e carvão
  ('Carvão 2,5kg',               'gelo e carvão', 20.00, 'un', 3, true),
  ('Carvão 5kg',                 'gelo e carvão', 40.00, 'un', 3, true),
  ('Gelo de água',               'gelo e carvão', 13.00, 'un', 5, true),
  ('Gelo de sabor',              'gelo e carvão',  3.00, 'un', 10, true),
  -- Tabacaria
  ('Seda Zomo',                  'tabacaria',  3.00, 'un', 5, true),
  ('Seda Alfafa',                'tabacaria',  4.50, 'un', 5, true),
  ('Carvão narguilé solto',      'tabacaria',  2.00, 'un', 10, true),
  ('Carvão narguilé fechado 1kg','tabacaria', 35.00, 'un', 2, true),
  ('Alumínio solto',             'tabacaria',  1.00, 'un', 10, true),
  ('Rosh',                       'tabacaria', 20.00, 'un', 2, true),
  ('Essência',                   'tabacaria', 16.00, 'un', 3, true),
  ('Tabaco Amsterdam',           'tabacaria', 20.00, 'un', 2, true),
  ('Tabaco Acrema',              'tabacaria', 20.00, 'un', 2, true),
  ('Paieiro',                    'tabacaria', 13.00, 'un', 3, true),
  ('Isqueiro BIC pequeno',       'tabacaria',  6.00, 'un', 3, true),
  ('Isqueiro BIC grande',        'tabacaria',  8.00, 'un', 3, true),
  ('Isqueiro Chechéleu',         'tabacaria',  3.00, 'un', 3, true),
  -- Destilados: garrafas
  ('Whisky Black Blend garrafa',     'destilados',  19.90, 'un', 2, true),
  ('Whisky Passaporte garrafa',      'destilados',  54.90, 'un', 2, true),
  ('Whisky Cavalo Branco garrafa',   'destilados',  70.00, 'un', 2, true),
  ('Whisky Red Label garrafa',       'destilados', 109.99, 'un', 2, true),
  ('Whisky Jack Daniel''s garrafa',  'destilados', 149.99, 'un', 2, true),
  ('Gin QN garrafa',                 'destilados',  24.90, 'un', 2, true),
  ('Gin Beefeater garrafa',          'destilados',  85.00, 'un', 2, true),
  ('Vodka Smirnoff garrafa',         'destilados',  50.00, 'un', 2, true),
  ('Vodka Absolut garrafa',          'destilados',  85.00, 'un', 2, true),
  ('Vodka Absolut sabores garrafa',  'destilados', 120.00, 'un', 2, true),
  ('Vodka Cîroc garrafa',            'destilados', 180.00, 'un', 1, true),
  ('Vodka Cîroc sabores garrafa',    'destilados', 260.00, 'un', 1, true),
  ('Licor 43 garrafa',               'destilados', 149.90, 'un', 1, true),
  ('Licor Ballena garrafa',          'destilados', 149.90, 'un', 1, true),
  -- Combos (sem controle de estoque)
  ('Combo Black Blend',                      'combos',  35.00, 'un', 0, false),
  ('Combo Passaporte',                       'combos',  68.00, 'un', 0, false),
  ('Combo Cavalo Branco',                    'combos',  90.00, 'un', 0, false),
  ('Combo Red Label + Red Bull',             'combos', 130.00, 'un', 0, false),
  ('Combo Jack Daniel''s + Red Bull',        'combos', 175.00, 'un', 0, false),
  ('Combo Gin QN',                           'combos',  45.00, 'un', 0, false),
  ('Combo Beefeater + Red Bull',             'combos', 130.00, 'un', 0, false),
  ('Combo Smirnoff',                         'combos',  75.00, 'un', 0, false),
  ('Combo Absolut + Red Bull',               'combos', 160.00, 'un', 0, false),
  ('Combo Absolut sabores + Red Bull',       'combos', 180.00, 'un', 0, false),
  ('Combo Cîroc + Red Bull',                 'combos', 230.00, 'un', 0, false),
  ('Combo Licor 43 + Red Bull',              'combos', 180.00, 'un', 0, false),
  -- Copão (sem controle de estoque)
  ('Copão Black Blend',                      'drinks/copão',  5.00, 'un', 0, false),
  ('Copão Passaporte',                       'drinks/copão', 13.00, 'un', 0, false),
  ('Copão Passaporte sabores',               'drinks/copão', 15.00, 'un', 0, false),
  ('Copão Cavalo Branco',                    'drinks/copão', 18.00, 'un', 0, false),
  ('Copão Red Label',                        'drinks/copão', 25.00, 'un', 0, false),
  ('Copão Jack Daniel''s',                   'drinks/copão', 30.00, 'un', 0, false),
  ('Copão Gin QN',                           'drinks/copão', 10.00, 'un', 0, false),
  ('Copão Gin Beefeater',                    'drinks/copão', 25.00, 'un', 0, false),
  ('Copão Smirnoff',                         'drinks/copão', 18.00, 'un', 0, false),
  ('Copão Absolut',                          'drinks/copão', 30.00, 'un', 0, false),
  ('Copão Cîroc c/ Red Bull',                'drinks/copão', 60.00, 'un', 0, false),
  ('Copão Licor 43 c/ Sprite',               'drinks/copão', 35.00, 'un', 0, false),
  ('Copão Licor 43 c/ Red Bull',             'drinks/copão', 40.00, 'un', 0, false),
  ('Copão Ballena c/ Smirnoff',              'drinks/copão', 45.00, 'un', 0, false),
  ('Adicional Red Bull/Monster no copão',    'drinks/copão', 10.00, 'un', 0, false),
  -- Caipirinhas e batidas 700 ml (sem controle de estoque)
  ('Caipirinha limão 700ml',                 'drinks/copão', 20.00, 'un', 0, false),
  ('Caipirinha morango 700ml',               'drinks/copão', 20.00, 'un', 0, false),
  ('Caipirinha maracujá 700ml',              'drinks/copão', 20.00, 'un', 0, false),
  ('Batida morango 700ml',                   'drinks/copão', 30.00, 'un', 0, false),
  ('Batida maracujá 700ml',                  'drinks/copão', 30.00, 'un', 0, false),
  ('Batida paçoca 700ml',                    'drinks/copão', 30.00, 'un', 0, false),
  ('Batida Ovomaltine 700ml',                'drinks/copão', 30.00, 'un', 0, false)
) as v(nome, categoria, preco, unidade, minimo, controla)
where not exists (select 1 from magal.produtos p where p.nome = v.nome and p.ativo);

-- Conferência
select categoria, count(*) as produtos from magal.produtos where ativo group by categoria order by categoria;
