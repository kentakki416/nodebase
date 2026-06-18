# infra/terraform

本プロジェクトの Terraform IaC ディレクトリ。**初回セットアップ手順は [`docs/setup/infra.md`](../../docs/setup/infra.md) を参照**。本ドキュメントは構成と日常運用コマンドのみまとめる。

## 外部ツール

- **[Trivy](https://trivy.dev/)**: Aqua Security 製の OSS セキュリティスキャナ。Terraform 設定ファイルのミスコンフィグや脆弱性を検出する
- **[TFLint](https://github.com/terraform-linters/tflint)**: Terraform 専用のリンター。非推奨構文やプロバイダ固有のルール違反を検出する

```bash
brew install terraform tflint trivy
```

## ディレクトリ構成

```
terraform/
├── aws/
│   ├── bootstrap/        # S3 バックエンド（state lock は S3 ネイティブの use_lockfile、初回のみ apply、local state）
│   ├── account/          # OIDC provider・GitHub Actions IAM role・ECR（AWS アカウント単位で共有）
│   ├── env/
│   │   ├── dev/          # 開発環境の設定
│   │   └── prd/          # 本番環境の設定
│   └── modules/          # 再利用可能なモジュール群（alb / ecs-cluster / ecs-workload / vpc 等）
├── .tflint.hcl           # TFLint 設定
└── README.md
```

層構造の詳細（apply 頻度・state の所在・CI 運用ルール・OIDC role 復旧手順）は [`CLAUDE.md`](CLAUDE.md) を参照。

## コマンド集

```bash
# --- デプロイ関連 ---
cd aws/env/<dev|prd>
terraform plan      # 差分検知
terraform apply     # デプロイ
terraform destroy   # 削除

# --- リント・バリデーション ---
terraform fmt -check -recursive -diff                                    # フォーマットチェック
terraform validate                                                       # バリデーション（aws/env/<env> 内で実行）
tflint --init                                                            # TFLint 初期化（初回のみ）
tflint --chdir=aws/env/dev --config=$(pwd)/.tflint.hcl --recursive       # TFLint チェック

# --- セキュリティスキャン ---
trivy config aws/env/dev -c aws/env/dev/.trivy.yml                       # dev (.trivyignore で一部チェックを除外)
trivy config aws/env/prd -c aws/env/dev/.trivy.yml                       # prd
```

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [`../../docs/setup/infra.md`](../../docs/setup/infra.md) | **初回セットアップ手順** |
| [`CLAUDE.md`](CLAUDE.md) | 層構造 / CI ワークフロー / OIDC role 復旧手順 |
| [`../README.md`](../README.md) | インフラ構成 / dev・prd の差分 / デプロイフロー |
| [AWS インフラ構成図](./aws-infrastructure.drawio) | drawio 形式の AWS インフラ構成図 |
