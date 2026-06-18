# =============================================================================
# 必須パラメータ
# =============================================================================

variable "name" {
  description = "workload 識別子 (例: nodebase-dev-api / nodebase-dev-worker)。task definition family / service 名 / IAM role 名のベース"
  type        = string
}

variable "cluster_arn" {
  description = "配置先 ECS cluster の ARN (modules/ecs-cluster の出力)"
  type        = string
}

variable "execution_role_arn" {
  description = "Task execution role ARN (modules/ecs-cluster の出力)"
  type        = string
}

variable "image" {
  description = "コンテナイメージ (ECR repo URL : tag)"
  type        = string
}

variable "subnets" {
  description = "task を配置する subnet ID のリスト"
  type        = list(string)
}

variable "security_groups" {
  description = "task に付与する Security Group ID のリスト"
  type        = list(string)
}

# =============================================================================
# Task definition 設定
# =============================================================================

variable "cpu" {
  description = "task の CPU ユニット (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "task のメモリ (MB)"
  type        = number
  default     = 512
}

variable "command" {
  description = "コンテナ起動コマンドを上書き。null なら Dockerfile の CMD を使用 (migration 等で利用)"
  type        = list(string)
  default     = null
}

variable "container_port" {
  description = "コンテナの listen ポート。null なら portMappings 無し (worker / one-shot 等)"
  type        = number
  default     = null
}

variable "environment" {
  description = "コンテナの環境変数 (非 secret)"
  type        = map(string)
  default     = {}
}

variable "secrets_arn" {
  description = "Secrets Manager の Secret ARN。secret_keys で指定したキーを valueFrom で個別注入"
  type        = string
  default     = null
}

variable "secret_keys" {
  description = "Secret から取り出して環境変数として注入するキーのリスト"
  type        = list(string)
  default     = []
}

variable "task_role_arn" {
  description = "task 内アプリが AWS API を呼ぶときの role ARN。null なら execution_role_arn と同じ"
  type        = string
  default     = null
}

# =============================================================================
# Service 設定
# =============================================================================

variable "create_service" {
  description = "false なら task definition のみ作って service は作らない (migration 等の one-shot)"
  type        = bool
  default     = true
}

variable "desired_count" {
  description = "service の希望タスク数 (create_service = true のとき有効)"
  type        = number
  default     = 1
}

variable "assign_public_ip" {
  description = "task に public IP を付与するか (private subnet 配置なら false)"
  type        = bool
  default     = false
}

variable "log_retention_in_days" {
  description = "CloudWatch Logs 保持日数"
  type        = number
  default     = 7
}

# =============================================================================
# ALB 連携 (optional)
# =============================================================================

variable "target_group_arn" {
  description = "ALB の target group ARN。指定すると service が target group に登録される (ALB から forward される workload に使う)"
  type        = string
  default     = null
}

# =============================================================================
# Blue/Green デプロイ (optional)
# =============================================================================
# 有効化すると以下が追加で作成される:
#   - SSM パラメータ (deploy approval)
#   - Lambda function (POST_TEST_TRAFFIC_SHIFT 時に承認待機)
#   - IAM roles: lambda 実行 / ECS lifecycle hook / ECS ALB service role
# 詳細は docs/spec/aws-deploy/step6-terraform-alb-https.md と
# modules/ecs-workload/lambda/deployment_hook.mjs を参照。

variable "enable_blue_green" {
  description = "true で ECS Blue/Green デプロイメントを有効化"
  type        = bool
  default     = false
}

variable "alternate_target_group_arn" {
  description = "Blue/Green の green TG ARN (enable_blue_green = true のとき必須)"
  type        = string
  default     = null
}

variable "production_listener_rule_arn" {
  description = "Blue/Green の production listener rule ARN"
  type        = string
  default     = null
}

variable "test_listener_rule_arn" {
  description = "Blue/Green の test listener rule ARN"
  type        = string
  default     = null
}

variable "bake_time_in_minutes" {
  description = "Blue/Green の bake time (test traffic 切替後の様子見時間)"
  type        = number
  default     = 5
}

variable "tags" {
  type    = map(string)
  default = {}
}
