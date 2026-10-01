#!/usr/bin/env bash
# Teste "porta aberta": procura exposição de dados no banco de produção.
#  1. Lê o estado real do banco (supabase/security/audit.sql, só leitura):
#     tabela sem RLS, política "true", política pra anon, view sem
#     security_invoker, SECURITY DEFINER sem search_path ou chamável
#     deslogado, coluna sensível legível, bucket público.
#  2. Faz o que um atacante faria: com a chave pública (a que vai pro
#     navegador), tenta ler cada tabela e listar cada bucket.
# Achado que não está em supabase/security/baseline.txt faz sair com erro.
#
# Precisa: supabase CLI e SUPABASE_ACCESS_TOKEN (o mesmo do
# deploy-migrations.yml). SUPABASE_ANON_KEY é opcional — sem ela, busca
# pela CLI.
set -uo pipefail

REF="${SUPABASE_PROJECT_REF:-grmayzeeemilvhjeninh}"
URL="https://${REF}.supabase.co"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASELINE="$ROOT/supabase/security/baseline.txt"

rc=0
out="$(supabase db query --linked --file "$ROOT/supabase/security/audit.sql" 2>&1)" || rc=$?
if [ $rc -ne 0 ] || ! grep -q "TABLE:" <<<"$out"; then
  echo "::error::Não consegui rodar a auditoria no banco (código $rc):"
  echo "$out"
  exit 2
fi

findings="$(grep -oE 'FINDING:[A-Za-z0-9_.:@/-]+' <<<"$out" | sed 's/^FINDING://')"
tables="$(grep -oE 'TABLE:[A-Za-z0-9_]+' <<<"$out" | sed 's/^TABLE://' | sort -u)"
buckets="$(grep -oE 'BUCKET:[A-Za-z0-9_.-]+' <<<"$out" | sed 's/^BUCKET://' | sort -u)"

# ---- 2. sondagem de fora, com a chave pública ----
ANON="${SUPABASE_ANON_KEY:-}"
if [ -z "$ANON" ]; then
  keys="$(supabase projects api-keys --project-ref "$REF" 2>/dev/null || true)"
  ANON="$(grep -iE 'anon|publishable' <<<"$keys" | grep -oE '(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+)' | head -1)"
fi
if [ -z "$ANON" ]; then
  echo "::warning::Sem chave pública — pulei a sondagem pela API (só a auditoria do banco rodou)."
else
  [ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::$ANON"
  body="$(mktemp)"
  for t in $tables; do
    code="$(curl -s -o "$body" -w '%{http_code}' "$URL/rest/v1/$t?select=*&limit=1" \
      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" || echo 000)"
    if [ "$code" = "200" ] && [ "$(tr -d '[:space:]' <"$body")" != "[]" ]; then
      findings+=$'\n'"anon-reads:$t"
    fi
  done
  for b in $buckets; do
    code="$(curl -s -o "$body" -w '%{http_code}' -X POST "$URL/storage/v1/object/list/$b" \
      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
      -d '{"prefix":"","limit":1}' || echo 000)"
    if [ "$code" = "200" ] && [ "$(tr -d '[:space:]' <"$body")" != "[]" ]; then
      findings+=$'\n'"anon-lists-bucket:$b"
    fi
  done
  rm -f "$body"
fi

# ---- 3. compara com a lista de achados aceitos ----
findings="$(grep -v '^$' <<<"$findings" | sort -u)"
accepted="$(grep -vE '^\s*(#|$)' "$BASELINE" | sed 's/[[:space:]]*#.*$//; s/[[:space:]]*$//' | sort -u)"
new="$(comm -23 <(echo "$findings") <(echo "$accepted") | grep -v '^$' || true)"
gone="$(comm -13 <(echo "$findings") <(echo "$accepted") | grep -v '^$' || true)"

echo "Tabelas sondadas: $(wc -w <<<"$tables" | tr -d ' ') · buckets: $(wc -w <<<"$buckets" | tr -d ' ') · achados: $(grep -c . <<<"$findings")"
if [ -n "$gone" ]; then
  echo "Achados aceitos que não aparecem mais (pode tirar do baseline.txt):"
  sed 's/^/  - /' <<<"$gone"
fi
if [ -n "$new" ]; then
  if [ "${REPORT_ONLY:-}" = "1" ]; then
    echo "Achados fora do baseline.txt (modo relatório, não falha):"
    sed 's/^/  + /' <<<"$new"
    exit 0
  fi
  echo "::error::Achados novos de exposição de dados — revise antes de aceitar no baseline.txt:"
  sed 's/^/  + /' <<<"$new"
  exit 1
fi
echo "Nenhum achado novo."
