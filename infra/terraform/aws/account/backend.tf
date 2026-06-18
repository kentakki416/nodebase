# =============================================================================
# Remote Backend Configuration
# =============================================================================
# bootstrap で作成された S3 バケットを使用する。
# bootstrap apply 後に bucket を実値で更新すること。
# State lock は S3 ネイティブの use_lockfile を使う (Terraform 1.10+)。

terraform {
  backend "s3" {
    bucket       = "nodebase-terraform-state-20250101"
    key          = "account/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
    encrypt      = true
  }
}
