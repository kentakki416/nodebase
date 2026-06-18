# =============================================================================
# Remote Backend Configuration
# =============================================================================
# Bootstrap で作成された S3 バケットを使用する。
# State lock は S3 ネイティブの use_lockfile を使う (Terraform 1.10+)。
#
# 注意: このファイルは変数を使用できないため、bootstrap 実行後に手動で更新してください
#
# 手順:
# 1. bootstrap/variables.tf の s3_bucket_name のデフォルト値を確認
# 2. 以下の bucket の値を更新
# 3. terraform init を実行

terraform {
  backend "s3" {
    bucket       = "nodebase-terraform-state-20250101" # TODO: bucket 名を bootstrap の出力に合わせて変更してください
    key          = "prd/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
    encrypt      = true
  }
}
