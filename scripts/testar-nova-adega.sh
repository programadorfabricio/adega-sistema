#!/bin/sh
# Prepara: instalador do pedido online no banco local, depois cria o cliente "testenovo" a partir de testeadega
set -e
R=/home/claude/adega-sistema
psql -h /tmp -p 5499 -U postgres -d postgres -q -c "drop schema if exists testenovo cascade" >/dev/null
sed "s/alvo text := 'public';/alvo text := 'testeadega';/" $R/supabase/pedido-online.sql > /var/tmp/pgt/sql/po-teste.sql
sed "s/novo   text := 'magal';/novo   text := 'testenovo';/; s/molde  text := 'public';/molde  text := 'testeadega';/" $R/supabase/nova-adega.sql > /var/tmp/pgt/sql/nova-teste.sql
cp $R/supabase/testes/nova-adega.test.sql /var/tmp/pgt/sql/
chmod 644 /var/tmp/pgt/sql/*
psql -h /tmp -p 5499 -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f /var/tmp/pgt/sql/po-teste.sql 2>&1 | grep -v NOTICE || true
for i in 1 2; do psql -h /tmp -p 5499 -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f /var/tmp/pgt/sql/nova-teste.sql 2>&1 | grep -v NOTICE || true; done
psql -h /tmp -p 5499 -U postgres -d postgres -q -v ON_ERROR_STOP=1 -f /var/tmp/pgt/sql/nova-adega.test.sql 2>&1 | grep -E "ERROR|OK:"
