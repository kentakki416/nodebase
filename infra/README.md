# infra

AWS デプロイ用の Infrastructure as Code (Terraform)。本ドキュメントは **構成と設計判断** をまとめる。初回セットアップの手順は [`docs/setup/infra.md`](../docs/setup/infra.md) を参照。

## 目次

- [構成](#構成)
- [dev / prd の差分](#dev--prd-の差分)
- [デプロイフロー](#デプロイフロー)
- [日常運用コマンド](#日常運用コマンド)
- [関連ドキュメント](#関連ドキュメント)

## 構成

```
infra/terraform/aws/
├── bootstrap/   # S3 backend のみ (state lock は S3 ネイティブの use_lockfile)。一度だけローカル apply (local state)
├── account/     # OIDC provider / GitHub Actions IAM role / ECR (アカウント単位、remote state)
├── env/
│   ├── dev/     # dev 環境 (rolling デプロイ、api.dev.<domain>)
│   └── prd/     # prd 環境 (Blue/Green デプロイ、api.<domain>)
└── modules/     # 再利用可能な module (vpc / alb / ecs-cluster / ecs-workload / rds / elasticache / acm / route53 / secrets)
```

Route 53 hosted zone は Terraform 管理外。Route 53 Domains でドメインを購入すると AWS が同名 hosted zone を自動作成し、Registrar 側の NS もその hosted zone に自動で向くため、env/{dev,prd} は `data "aws_route53_zone"` で参照するだけで済む（[公式ドキュメント](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html)）。

リソースの「生存期間」で 3 層に分かれており、apply の頻度と権限の境界が異なる:

| 層 | 何を作るか | apply 頻度 | state |
|---|---|---|---|
| `bootstrap` | tfstate 置き場 (S3) | 1 度だけ | local |
| `account` | OIDC / IAM role / ECR | アカウント単位の共有資源を増やす時のみ | remote |
| `env/*` | VPC / ECS / RDS / ALB / ACM / Route53 A レコード ... | 機能追加のたび | remote |

## dev / prd の差分

| 項目 | dev | prd |
|---|---|---|
| デプロイ戦略 | rolling (deployment_circuit_breaker 付き) | **Blue/Green** (POST_TEST_TRAFFIC_SHIFT で SSM 承認待機) |
| 承認ゲート | 無し | GitHub Environment `prd-api-approval` の Required reviewers |
| ALB test listener (port 9000) | 無し | 有り (test_listener_allowed_cidrs で CIDR 制限可) |
| API FQDN | `api.dev.<domain>` | `api.<domain>` |
| ACM 証明書 | `*.dev.<domain>` | `*.<domain>` |
| Route53 hosted zone | Route 53 Domains 購入時に自動作成された zone を data source で参照 | dev と同じ（dev / prd で同一 zone を共有） |
| VPC CIDR | `10.0.0.0/16` | `10.1.0.0/16` |
| state key | `dev/terraform.tfstate` | `prd/terraform.tfstate` |
| RDS / ElastiCache | 最小構成 (single AZ, snapshot OFF, TLS OFF) | dev と同等 (※将来本番強化したい場合は別途) |

## デプロイフロー

両環境とも GitHub Actions の `workflow_dispatch` 起動で `Deploy to AWS dev` / `Deploy to AWS prd` を回す。

- **dev**: `build → migrate → deploy-api / deploy-worker (rolling 完走)` の素直なフロー。承認ゲートなし
- **prd**: `build → migrate → deploy-api (Blue/Green 投入) → approve-api (GitHub UI で Required reviewers が承認) → 本番トラフィックシフト + 5 分 bake` という Blue/Green フロー。承認 reject 時は `reject-api` job が SSM を `rejected` に書き換えて自動 rollback

詳細な job 構成はワークフロー本体（`.github/workflows/deploy-aws-{dev,prd}.yml`）のヘッダコメントを参照。

## 日常運用コマンド

```bash
# env apply (ローカルから流す場合)
cd infra/terraform/aws/env/<dev|prd>
terraform plan
terraform apply

# fmt / lint / security
cd infra/terraform
terraform fmt -check -recursive -diff
tflint --init && tflint --chdir=aws/env/dev --config=$(pwd)/.tflint.hcl --recursive
trivy config aws/env/dev -c .trivy.yml
```

prd の Blue/Green 承認は GitHub Actions UI の "Review pending deployments" から行う（`Deploy to AWS prd` workflow の `approve-api` job）。UI が使えない緊急時のみ、ローカル CLI から直接 SSM を書き換えて承認 / 拒否する:

```bash
# 承認
aws ssm put-parameter --name "/my-app-prd-api/deploy/approval" --value "approved"  --overwrite
# 拒否してロールバック
aws ssm put-parameter --name "/my-app-prd-api/deploy/approval" --value "rejected" --overwrite
```

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [`../docs/setup/infra.md`](../docs/setup/infra.md) | **初回セットアップ手順** (bootstrap → account → GitHub Environments → env apply → DNS 委任 → seed-secrets → image push) |
| [`terraform/CLAUDE.md`](terraform/CLAUDE.md) | Terraform 層構造 / CI ワークフロー / OIDC role 復旧手順 |
| [`../docs/spec/shared-packages/README.md`](../docs/spec/shared-packages/README.md) | server-side app が共有する `@repo/db` / `logger` / `errors` / `redis` の設計 |
| [`../apps/api/README.md`](../apps/api/README.md) | API サーバーの設計思想・テスト戦略 |
| [`../docs/setup/api.md`](../docs/setup/api.md) | API サーバーのローカル起動手順 |
