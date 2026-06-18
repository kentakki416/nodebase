# scripts

本リポジトリのオペレーション系シェルスクリプト置き場。

## 一覧

| スクリプト | 用途 |
|---|---|
| [seed-secrets.sh](#seed-secretssh) | apply 後に AWS Secrets Manager へ外部 secret と RDS / Redis 接続情報を投入 |

---

## seed-secrets.sh

`terraform apply` で作成された Secrets Manager の箱 (`/nodebase-<env>/app`) に、以下の値を一括投入する:

| Key | 出所 | 自動 / 手動 |
|---|---|---|
| `DATABASE_URL` | `terraform output` + RDS の AWS 管理パスワード | **自動構築** |
| `REDIS_HOST` | `terraform output` (step5 で activate) | **自動構築** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 環境変数 | **要 export** |
| `LIVEKIT_HOST` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_WEBHOOK_SECRET` | 環境変数 | **要 export** |
| `FRONTEND_URL` | 環境変数 | **要 export** |
| `JWT_*` / `NODE_ENV` / `PORT` 等 | （Terraform 投入済み、触らない） | - |

特徴:
- **idempotent**: 何度実行しても OK。未設定の key は skip + warn
- **段階的**: RDS / ElastiCache がまだ deploy されていなくても、揃っている分だけ投入
- **merge ベース**: 既存の Terraform 投入値 (JWT 等) を上書きしない

### 前提条件

#### 1. CLI ツール

| コマンド | インストール例 (macOS) |
|---|---|
| `aws` (CLI v2) | `brew install awscli` |
| `jq` | `brew install jq` |
| `terraform` | `brew install terraform` |

#### 2. AWS 認証

`aws sts get-caller-identity` が通る状態が必要。3 通りの設定方法のいずれか:

##### (a) `aws configure` で固定 access key を保存

```bash
aws configure
# AWS Access Key ID:     AKIA...
# AWS Secret Access Key: ...
# Default region name:   ap-northeast-1
# Default output format: json
```

##### (b) AWS SSO (推奨、組織で SSO を使っている場合)

```bash
aws configure sso
aws sso login --profile <profile-name>
export AWS_PROFILE=<profile-name>
```

##### (c) 環境変数で直接

```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="ap-northeast-1"
```

確認:

```bash
aws sts get-caller-identity
# 自分のアカウント ID と ARN が返ればOK
```

#### 3. Terraform backend 接続

スクリプトは `terraform output` で値を引くため、対象 env で `terraform init` が済んでいる必要がある:

```bash
cd infra/terraform/aws/env/dev
terraform init
```

#### 4. 環境変数の設定

`seed-secrets.sh` は以下の環境変数を読む:

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
LIVEKIT_HOST
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_WEBHOOK_SECRET
FRONTEND_URL
```

設定方法は 2 つ。**(a) を推奨** (`apps/api/.env.local` がすでに dotenvx 暗号化済みで `.env.keys` も symlink で揃っているため、追加セットアップ不要)。

##### (a) dotenvx 経由で `apps/api/.env.local` を流す（推奨）

```bash
npx dotenvx run -f apps/api/.env.local -- ./scripts/seed-secrets.sh dev
```

- `apps/api/.env.local` で既に管理している GOOGLE / LIVEKIT 等の値がそのまま使われる
- AWS dev 用に上書きしたい値があれば事前に `export` しておけば優先される:

  ```bash
  FRONTEND_URL="https://nodebase-xxx.vercel.app" \
    npx dotenvx run -f apps/api/.env.local -- ./scripts/seed-secrets.sh dev
  ```

- `LIVEKIT_WEBHOOK_SECRET` のように `.env.local` に未登録の値は skip + warn が出る（後で `npx dotenvx set` で追加して再実行）

##### (b) 都度 export

```bash
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
# ... 略
./scripts/seed-secrets.sh dev
```

### 使い方

```bash
# 基本形
./scripts/seed-secrets.sh <env>

# 推奨: dotenvx 経由
npx dotenvx run -f apps/api/.env.local -- ./scripts/seed-secrets.sh dev
```

実行イメージ:

```
==> Seeding secrets for /nodebase-dev/app
==> External secrets (from environment variables)
  ✓ GOOGLE_CLIENT_ID (from env)
  ✓ GOOGLE_CLIENT_SECRET (from env)
  ✓ LIVEKIT_HOST (from env)
  ✓ LIVEKIT_API_KEY (from env)
  ✓ LIVEKIT_API_SECRET (from env)
  ✓ LIVEKIT_WEBHOOK_SECRET (from env)
  ✓ FRONTEND_URL (from env)
==> Infrastructure-derived secrets (from terraform output)
  ✓ DATABASE_URL (constructed from RDS outputs)
  - REDIS_HOST (skipped, ElastiCache not deployed yet)
==> Updated 8 keys in /nodebase-dev/app
```

### destroy / apply サイクルでの典型的な使い方

```bash
cd infra/terraform/aws/env/dev

# 全部消す
terraform destroy

# 再構築 (3〜15 分)
terraform apply

# secret 投入 (10 秒、dotenvx で apps/api/.env.local の値を流す)
cd /Users/.../nodebase
npx dotenvx run -f apps/api/.env.local -- ./scripts/seed-secrets.sh dev
```

これで dev 環境がフル復活する。

### トラブルシュート

| 症状 | 原因 / 対処 |
|---|---|
| `ERROR: 'aws' not installed` | AWS CLI を install (`brew install awscli`) |
| `Credentials could not be loaded` | `aws sts get-caller-identity` が通るか確認。`AWS_PROFILE` の export 漏れ、SSO セッション切れなど |
| `Resource not found in this region` | `AWS_REGION` または `--region` 指定。`ap-northeast-1` が想定 |
| `terraform output -raw rds_address` が失敗 | 対象 env で `terraform init` 後、`terraform apply` 済みか確認 |
| `- GOOGLE_CLIENT_SECRET (skipped, env)` | `apps/api/.env.local` に値が無いか、shell に export していない |
| `Secret name already scheduled for deletion` | 過去の destroy で残骸あり。`recovery_window_in_days = 0` 設定済みの dev では起きないはずだが、起きたら `aws secretsmanager delete-secret --secret-id ... --force-delete-without-recovery` で完全削除 |

### 直接 AWS Console で値を確認したいとき

```bash
aws secretsmanager get-secret-value \
  --secret-id /nodebase-dev/app \
  --query SecretString --output text | jq .
```
