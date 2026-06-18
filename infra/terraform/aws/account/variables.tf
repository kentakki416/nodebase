# =============================================================================
# Account-scoped Variables
# =============================================================================
# AWS アカウント単位で共有するリソース（OIDC provider, ECR, GitHub Actions IAM role）
# 用の variables。env/{dev,prd} に依存せず単独で apply できる。

variable "project_name" {
  description = "プロジェクト名"
  type        = string
  default     = "nodebase"
}

variable "aws_region" {
  description = "AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "github_repository" {
  description = "GitHub リポジトリ（例: owner/repo-name）"
  type        = string
  default     = "kentakki416/nodebase"
}
