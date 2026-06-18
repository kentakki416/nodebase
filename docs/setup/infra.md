# Infra セットアップ手順

AWS デプロイ用 Infrastructure as Code (Terraform) の **初回セットアップ手順**。テンプレートはこのままだと動かないので、下記の順序を必ず守ること。

設計やレイヤー構造の概要は [`infra/README.md`](../../infra/README.md) を参照。

## 目次

- [前提条件](#前提条件)
- [前提ツール](#前提ツール)
- [初回セットアップ手順](#初回セットアップ手順)
  - [1. AWS 認証の準備](#1-aws-認証の準備)
  - [2. プロジェクト名・ドメイン名の置き換え](#2-プロジェクト名ドメイン名の置き換え)
  - [3. bootstrap (state バックエンドを作る)](#3-bootstrap-state-バックエンドを作る)
  - [4. backend.tf の bucket を bootstrap 出力に差し替え](#4-backendtf-の-bucket-を-bootstrap-出力に差し替え)
  - [5. account (ECR + GitHub Actions OIDC)](#5-account-ecr--github-actions-oidc)
  - [6. GitHub Environments の作成と AWS\_ROLE\_ARN 登録](#6-github-environments-の作成と-aws_role_arn-登録)
  - [7. env/prd と env/dev を apply](#7-envprd-と-envdev-を-apply)
  - [8. seed-secrets.sh で外部 Secret を投入](#8-seed-secretssh-で外部-secret-を投入)
  - [9. deploy workflow で ECR にイメージを push](#9-deploy-workflow-で-ecr-にイメージを-push)

## 前提条件

infra apply を始める前に以下を済ませておくこと。Terraform で管理できない外部依存。

- [ ] AWS アカウントを用意し、ローカルから API を叩ける IAM ユーザー（または SSO セッション）を発行する
- [ ] **Route 53 Domains（= Route 53 Registrar）でドメインを購入する**。購入時に AWS が同名の hosted zone を自動作成し、Registrar 側の NS もその hosted zone に自動で向けられる（[公式ドキュメント](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html)）。Terraform 側はこの自動作成された hosted zone を data source で参照するだけで済み、NS 書き換えや別 hosted zone の新規作成は行わない

## 前提ツール

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.10 (state lock を S3 ネイティブ (`use_lockfile`) で取得するため)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) v2 (`aws configure` 済み)
- [tflint](https://github.com/terraform-linters/tflint) (任意、CI で使うため推奨)
- [trivy](https://aquasecurity.github.io/trivy/) (任意、CI で使うため推奨)
- [jq](https://jqlang.github.io/jq/) (`seed-secrets.sh` で必要)

## 初回セットアップ手順

### 1. AWS 認証の準備

- [ ] ローカルから `terraform apply` を実行するために IAM ユーザー (もしくは SSO セッション) で `aws configure` を済ませる。bootstrap / account 層は CI から触れないため、必ずローカルから流す前提。

```bash
aws configure
aws sts get-caller-identity
```

### 2. プロジェクト名・ドメイン名の置き換え

- [ ] テンプレート同梱のデフォルト値を、実際のプロジェクト名・ドメインに置き換える。各ファイルに `TODO` コメントが付いている。

| ファイル | 変数 | 既定値 | 変更例 |
|---|---|---|---|
| `aws/bootstrap/variables.tf` | `project_name` | `nodebase` | プロジェクト名（既定のままで OK） |
| `aws/bootstrap/variables.tf` | `s3_bucket_name` | `nodebase-terraform-state-20250101` | `nodebase-tfstate-20260614` 等（世界一意） |
| `aws/account/variables.tf` | `project_name` / `github_repository` | `nodebase` / `owner/repo` | `nodebase` / `<your-org>/nodebase` |
| `aws/env/{dev,prd}/variables.tf` | `project_name` | `nodebase` | プロジェクト名（既定のままで OK） |
| `aws/env/{dev,prd}/variables.tf` | `domain_name` | `nodebase.com` | Route 53 で買った実ドメイン（dev と prd で同じ値） |
| `aws/env/{dev,prd}/backend.tf` | `bucket` | テンプレ既定値 | bootstrap 出力に揃える (手順 4) |


### 3. bootstrap (state バックエンドを作る)

- [ ] bootstrap だけは local state（S3 と chicken-and-egg のため）。生成された `terraform.tfstate` はリポジトリに含めない（`.gitignore` 済み）。

⚠️ State lock は別途 DynamoDB を作らず、Terraform 1.10+ の S3 ネイティブロック (`use_lockfile = true`) で同じバケット内のロックファイルを使う。

```bash
cd infra/terraform/aws/bootstrap
terraform init
terraform plan
terraform apply
terraform output
# s3_bucket_name = "my-app-tfstate-20260614"
```

### 4. backend.tf の bucket を bootstrap 出力に差し替え

- [ ] 手順 3 で出力された `s3_bucket_name` を、`account` / `env/dev` / `env/prd` の 3 つの `backend.tf` の `bucket` に転記する。

```hcl
terraform {
  backend "s3" {
    bucket       = "my-app-tfstate-20260614" # ← bootstrap output に差し替え
    key          = "prd/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
    encrypt      = true
  }
}
```

### 5. account (ECR + GitHub Actions OIDC)

- [ ] account 層は AWS アカウント単位で共有するリソース（GitHub Actions の IAM role と ECR）を作る。Route 53 hosted zone はドメイン購入時に AWS が自動で作るため Terraform 管理外。

```bash
cd infra/terraform/aws/account
terraform init
terraform apply
terraform output -raw github_actions_dev_role_arn
terraform output -raw github_actions_prd_role_arn
```

### 6. GitHub Environments の作成と AWS_ROLE_ARN 登録

- [ ] GitHub リポジトリの **Settings → Environments** から下記 3 つを作成し、各 Environment の **Secrets** に `AWS_ROLE_ARN`（手順 5 で控えた値）を登録する。account 側の OIDC role の trust policy は Environment 名（`dev` / `prd` / `prd-api-approval`）を sub claim で受け取って AssumeRole を許可しているので、**Environment 名は完全一致**で作る必要がある。
  1. `dev` — `AWS_ROLE_ARN` = `github_actions_dev_role_arn`
  2. `prd` — `AWS_ROLE_ARN` = `github_actions_prd_role_arn`、Deployment branches は `main` 推奨
  3. `prd-api-approval` — `AWS_ROLE_ARN` = `github_actions_prd_role_arn`（`prd` と同じ値）、Required reviewers にリリース承認者を 1 名以上、Deployment branches は `main` 推奨

dev は Blue/Green ではなく rolling 更新で承認ゲートを持たないため、`dev-api-approval` は不要。

### 7. env/prd と env/dev を apply

- [ ] GitHub Actions の `terraform-aws-env-apply.yml` (workflow_dispatch) からも実行可能。CI 経由で流す場合は手順 6 の Environment 登録が完了している必要がある。

```bash
# prd
cd infra/terraform/aws/env/prd
terraform init
terraform apply
terraform output api_url

# dev (prd と並行に実行して OK)
cd ../dev
terraform init
terraform apply
terraform output api_url
```

### 8. seed-secrets.sh で外部 Secret を投入

- [ ] Terraform は「箱」（Secrets Manager の secret）と JWT 鍵だけ作る方針。`DATABASE_URL` / `REDIS_HOST` / `FRONTEND_URL` 等の環境変数は `scripts/seed-secrets.sh` でローカルから投入する。スクリプトは terraform output から RDS / Redis のエンドポイントを引いて `DATABASE_URL` / `REDIS_HOST` を組み立てる。

```bash
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export LIVEKIT_HOST=...
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...
export FRONTEND_URL=https://my-app.com

./scripts/seed-secrets.sh dev
./scripts/seed-secrets.sh prd
```

### 9. deploy workflow で ECR にイメージを push

- [ ] GitHub の **Actions タブ → `Deploy to AWS dev` workflow → `Run workflow`（`main` ブランチ）** で dev のデプロイを起動する
- [ ] GitHub の **Actions タブ → `Deploy to AWS prd` workflow → `Run workflow`（`main` ブランチ）** で prd のデプロイを起動する。`approve-api` job で停止したら **Actions UI の "Review pending deployments"** から `prd-api-approval` の reviewer として Approve すると Blue/Green が本番トラフィックシフト + 5 分 bake に進む

（ここまでで env apply は完了しているが、ECR がまだ空なので ECS task は `CannotPullContainerError` で起動失敗している状態。GitHub Actions の deploy workflow を CI から実行して image を push すれば、ECS が自動で再 pull して正常化する。）

