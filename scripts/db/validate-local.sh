#!/usr/bin/env bash
# =============================================================================
# Artemis — validação do banco SEM Docker
#
# Cria um banco novo num Postgres local (16+ com pgvector), aplica o "stub" do
# Supabase, todas as migrations em ordem, os seeds (supabase/seed.sql e depois
# supabase/seeds/*.sql, como no config.toml) e os testes de RLS/regras.
# Para no primeiro erro (psql -v ON_ERROR_STOP=1).
#
# Uso:
#   scripts/db/validate-local.sh                 # usa 127.0.0.1:54329, usuário postgres
#   PGPORT=5432 DB_NAME=meu_teste scripts/db/validate-local.sh
#   KEEP_DB=1 scripts/db/validate-local.sh       # não apaga o banco no final
#   SKIP_SEED=1 scripts/db/validate-local.sh     # só migrations + testes
#
# Variáveis: PGHOST (127.0.0.1), PGPORT (54329), PGUSER (postgres), DB_NAME
# (ciencia_delas_validate). Requer psql no PATH e as extensões vector, citext,
# pg_trgm e pgcrypto instaladas no servidor.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-54329}"
export PGUSER="${PGUSER:-postgres}"
DB_NAME="${DB_NAME:-ciencia_delas_validate}"

PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc)

step() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }

step "Recriando o banco ${DB_NAME} em ${PGHOST}:${PGPORT}"
"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME} with (force);"
"${PSQL[@]}" -d postgres -c "create database ${DB_NAME};"

run_file() {
  local file="$1"
  echo "   - ${file#"${ROOT_DIR}/"}"
  "${PSQL[@]}" -d "${DB_NAME}" -f "$file"
}

step "Aplicando o stub do Supabase"
run_file "${ROOT_DIR}/scripts/db/supabase-stub.sql"
run_file "${ROOT_DIR}/scripts/db/pgtap-shim.sql"

step "Aplicando migrations"
shopt -s nullglob
migrations=("${ROOT_DIR}"/supabase/migrations/*.sql)
if [[ ${#migrations[@]} -eq 0 ]]; then
  echo "Nenhuma migration encontrada em supabase/migrations" >&2
  exit 1
fi
for f in "${migrations[@]}"; do
  run_file "$f"
done

if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  # Mesma ordem do supabase/config.toml ([db.seed] sql_paths = ['./seed.sql', './seeds/*.sql']):
  # primeiro o seed principal, depois supabase/seeds/*.sql em ordem alfabética (10_, 20_, ...).
  step "Aplicando seeds"
  run_file "${ROOT_DIR}/supabase/seed.sql"
  seeds=("${ROOT_DIR}"/supabase/seeds/*.sql)
  for f in "${seeds[@]}"; do
    run_file "$f"
  done
fi

step "Rodando testes"
tests=("${ROOT_DIR}"/supabase/tests/database/*.sql)
failed=()
for f in "${tests[@]}"; do
  echo "   - ${f#"${ROOT_DIR}/"}"
  # Mesmo formato do pg_prove: saída TAP limpa (sem cabeçalhos de tabela).
  out="$("${PSQL[@]}" -tA -d "${DB_NAME}" -f "$f")"
  sed -e '/^$/d' -e 's/^/     /' <<<"$out"
  # Um "not ok" não interrompe o psql: conferimos a saída TAP de cada arquivo.
  if grep -q '^not ok' <<<"$out"; then
    failed+=("${f#"${ROOT_DIR}/"}")
  fi
done

if [[ ${#failed[@]} -gt 0 ]]; then
  printf '\nTestes com falha (not ok): %s\n' "${failed[*]}" >&2
  echo "Banco mantido para investigar: postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${DB_NAME}" >&2
  exit 1
fi

if [[ "${KEEP_DB:-0}" != "1" ]]; then
  "${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME} with (force);"
else
  echo
  echo "Banco mantido: postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${DB_NAME}"
fi

step "Tudo certo: migrations, seeds e testes passaram."
