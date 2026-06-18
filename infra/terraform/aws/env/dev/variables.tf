# =============================================================================
# 基本設定
# =============================================================================

variable "project_name" {
  description = "プロジェクト名"
  type        = string
  default     = "nodebase" # TODO: bootstrapと同じプロジェクト名に変更してください
}

variable "environment" {
  description = "環境名（dev, stg, prd）"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}


# =============================================================================
# DNS 設定
# =============================================================================
# hosted zone は prd で作成 / 管理する。dev は data source で参照するため、
# domain_name は prd と必ず同じ値にすること (テンプレ既定値は prd と同じ)。

variable "domain_name" {
  description = "Route53 hosted zone のベースドメイン (prd で作成済みの zone)。dev は data source で参照する"
  type        = string
  default     = "nodebase.com" # TODO: prd と揃えて実ドメインに変更してください
}

variable "subdomain" {
  description = "dev 用サブドメイン。<api_subdomain>.<subdomain>.<domain_name> が API の FQDN になる (例: api.dev.nodebase.com)"
  type        = string
  default     = "dev"
}

variable "api_subdomain" {
  description = "API の FQDN の左側ラベル"
  type        = string
  default     = "api"
}

# =============================================================================
# ネットワーク設定
# =============================================================================

variable "vpc_cidr" {
  description = "VPCのCIDRブロック"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "使用するAvailability Zones"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}

# =============================================================================
# アプリケーション設定
# =============================================================================

variable "app_port" {
  description = "アプリケーションのポート番号"
  type        = number
  default     = 8080
}

# =============================================================================
# ECS設定
# =============================================================================

variable "ecs_task_cpu" {
  description = "ECSタスクのCPUユニット（256 = 0.25 vCPU, 512 = 0.5 vCPU, 1024 = 1 vCPU）"
  type        = string
  default     = "256"
}

variable "ecs_task_memory" {
  description = "ECSタスクのメモリ（MB）"
  type        = string
  default     = "512"
}

variable "log_retention_days" {
  description = "CloudWatch Logsの保存期間（日数）"
  type        = number
  default     = 3
}

# =============================================================================
# タグ設定
# =============================================================================

variable "additional_tags" {
  description = "追加のタグ"
  type        = map(string)
  default     = {}
}

# =============================================================================
# Secrets (アプリケーション機密)
# =============================================================================
# 方針: Terraform は「箱」(Secrets Manager secret) と「初回 JWT 自動生成」までを管理し、
# 残りの値 (DATABASE_URL / REDIS_HOST / GOOGLE_* / LIVEKIT_* / FRONTEND_URL) は
# Console / CLI で手動登録する。secret_version は ignore_changes でガード済み。
#
# dev/prd で運用差を作らないため変数化はしない。
