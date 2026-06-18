#!/usr/bin/env bash
# =============================================================================
# scripts/seed-secrets.sh
# =============================================================================
# Application secret (/nodebase-<env>/app) に以下を投入する:
#   1. RDS / ElastiCache の接続情報 (terraform output から自動構築)
#   2. 外部サービスの secret (環境変数から)
#
# Terraform が管理する JWT_* / NODE_ENV / PORT 等は触らず、merge で追加する。
# (modules/secrets の ignore_changes により Terraform は secret_string 更新を見ない)
#
# Usage:
#   ./scripts/seed-secrets.sh <env>
#
# Example:
#   ./scripts/seed-secrets.sh dev
#
# 環境変数 (どれも未設定なら skip + warn、後で再実行で OK):
#   GOOGLE_CLIENT_ID
#   GOOGLE_CLIENT_SECRET
#   LIVEKIT_HOST
#   LIVEKIT_API_KEY
#   LIVEKIT_API_SECRET
#   FRONTEND_URL
#
# direnv (.envrc) で上記を export しておくと毎回入力不要。
# =============================================================================

set -euo pipefail

ENV="${1:-}"
if [ -z "$ENV" ]; then
  echo "Usage: $0 <env>" >&2
  echo "Example: $0 dev" >&2
  exit 1
fi

SECRET_NAME="/nodebase-${ENV}/app"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/terraform/aws/env/${ENV}"

if [ ! -d "$TF_DIR" ]; then
  echo "ERROR: terraform directory not found: $TF_DIR" >&2
  exit 1
fi

# 依存コマンド確認
for cmd in aws jq terraform; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: '$cmd' not installed" >&2
    exit 1
  fi
done

echo "==> Seeding secrets for ${SECRET_NAME}"

# ============================================================================
# 1. 既存の Secret を取得 (Terraform が投入した JWT 等が入っている)
# ============================================================================
CURRENT=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --query SecretString --output text 2>/dev/null || echo '{}')

# 投入する key-value を JSON で組み立てる
NEW_VALUES=$(jq -n '{}')

add_kv() {
  local key="$1"
  local value="$2"
  local source="$3"
  if [ -n "$value" ]; then
    NEW_VALUES=$(echo "$NEW_VALUES" | jq --arg k "$key" --arg v "$value" '. + {($k): $v}')
    echo "  ✓ $key (from $source)"
  else
    echo "  - $key (skipped, $source)"
  fi
}

# ============================================================================
# 2. 外部サービス: 環境変数から
# ============================================================================
echo "==> External secrets (from environment variables)"
add_kv "GOOGLE_CLIENT_ID"       "${GOOGLE_CLIENT_ID:-}"       "env"
add_kv "GOOGLE_CLIENT_SECRET"   "${GOOGLE_CLIENT_SECRET:-}"   "env"
add_kv "LIVEKIT_HOST"           "${LIVEKIT_HOST:-}"           "env"
add_kv "LIVEKIT_API_KEY"        "${LIVEKIT_API_KEY:-}"        "env"
add_kv "LIVEKIT_API_SECRET"     "${LIVEKIT_API_SECRET:-}"     "env"
add_kv "FRONTEND_URL"           "${FRONTEND_URL:-}"           "env"

# ============================================================================
# 3. RDS: terraform output + master_user_secret から DATABASE_URL を構築
# ============================================================================
echo "==> Infrastructure-derived secrets (from terraform output)"

if RDS_ADDRESS=$(terraform -chdir="$TF_DIR" output -raw rds_address 2>/dev/null); then
  RDS_DB_NAME=$(terraform -chdir="$TF_DIR" output -raw rds_db_name)
  RDS_USERNAME=$(terraform -chdir="$TF_DIR" output -raw rds_master_username)
  RDS_SECRET_ARN=$(terraform -chdir="$TF_DIR" output -raw rds_master_user_secret_arn)

  RDS_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id "$RDS_SECRET_ARN" \
    --query SecretString --output text | jq -r .password)

  # パスワードに URL 不適合な文字が混じることがあるため percent-encode
  ENCODED_PW=$(jq -rn --arg p "$RDS_PASSWORD" '$p|@uri')
  DATABASE_URL="postgresql://${RDS_USERNAME}:${ENCODED_PW}@${RDS_ADDRESS}:5432/${RDS_DB_NAME}?sslmode=require"

  NEW_VALUES=$(echo "$NEW_VALUES" | jq --arg url "$DATABASE_URL" '. + { DATABASE_URL: $url }')
  echo "  ✓ DATABASE_URL (constructed from RDS outputs)"
else
  echo "  - DATABASE_URL (skipped, RDS not deployed yet)"
fi

# ============================================================================
# 4. ElastiCache: terraform output から REDIS_HOST
# ============================================================================
if REDIS_HOST=$(terraform -chdir="$TF_DIR" output -raw redis_address 2>/dev/null); then
  NEW_VALUES=$(echo "$NEW_VALUES" | jq --arg h "$REDIS_HOST" '. + { REDIS_HOST: $h }')
  echo "  ✓ REDIS_HOST (from terraform output)"
else
  echo "  - REDIS_HOST (skipped, ElastiCache not deployed yet)"
fi

# ============================================================================
# 5. 既存と merge して put
# ============================================================================
UPDATED_COUNT=$(echo "$NEW_VALUES" | jq 'keys | length')
if [ "$UPDATED_COUNT" -eq 0 ]; then
  echo "==> No new values to add. Exit."
  exit 0
fi

MERGED=$(echo "$CURRENT" | jq --argjson new "$NEW_VALUES" '. + $new')

aws secretsmanager put-secret-value \
  --secret-id "$SECRET_NAME" \
  --secret-string "$MERGED" \
  >/dev/null

echo "==> Updated ${UPDATED_COUNT} keys in ${SECRET_NAME}"
