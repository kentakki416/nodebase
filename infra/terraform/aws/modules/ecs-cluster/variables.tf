variable "name" {
  description = "ECS cluster 名 (例: nodebase-dev-cluster)"
  type        = string
}

variable "container_insights_enabled" {
  description = "CloudWatch Container Insights を有効化するか"
  type        = bool
  default     = true
}

variable "secret_arns_readable" {
  description = "Task execution role が secretsmanager:GetSecretValue で読み出せる Secrets Manager の ARN リスト。全 workload で共通の secret アクセス権を一元管理する"
  type        = list(string)
  default     = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
