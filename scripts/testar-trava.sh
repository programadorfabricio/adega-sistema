#!/bin/sh
# Instala as funções de supabase/trava.sql no banco local (sem o bloco final, que tranca uma adega)
# e roda supabase/testes/trava.test.sql (tudo em begin/rollback: testeadega fica destrancada).
set -e
R=/home/claude/adega-sistema
P="psql -h /tmp -p 5499 -U postgres -d postgres -q -v ON_ERROR_STOP=1"
sed '/^do \$\$/,/^end \$\$;/d' $R/supabase/trava.sql > /var/tmp/pgt/sql/trava-funcoes.sql
cp $R/supabase/testes/trava.test.sql /var/tmp/pgt/sql/
chmod 644 /var/tmp/pgt/sql/*
$P -f /var/tmp/pgt/sql/trava-funcoes.sql
$P -f /var/tmp/pgt/sql/trava.test.sql
