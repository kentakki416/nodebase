variable "name" {
  description = "ElastiCache replication group 識別子 (例: nodebase-dev-redis)"
  type        = string
}

variable "engine_version" {
  description = "Redis エンジンバージョン"
  type        = string
  default     = "7.1"
}

variable "node_type" {
  description = "ノードタイプ"
  type        = string
  default     = "cache.t4g.micro"
}

variable "num_cache_clusters" {
  description = "ノード数。1 で primary only、2+ で replica あり (multi_az_enabled と組み合わせて使う)"
  type        = number
  default     = 1
}

variable "automatic_failover_enabled" {
  description = "primary 障害時の自動 failover (replica 必要)"
  type        = bool
  default     = false
}

variable "multi_az_enabled" {
  description = "Multi-AZ 配置 (本番のみ true 推奨、automatic_failover_enabled=true 必須)"
  type        = bool
  default     = false
}

variable "subnet_ids" {
  description = "isolated subnet ID のリスト (最低 2 AZ)"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Redis に付与する SG ID"
  type        = list(string)
}

variable "parameter_group_family" {
  description = "Redis parameter group family (redis7 / redis7.1 等)。engine_version と整合させる"
  type        = string
  default     = "redis7"
}

variable "parameter_group_parameters" {
  description = "parameter group の上書き parameter。dev は空、prd でチューニングするときに使う"
  type        = list(object({ name = string, value = string }))
  default     = []
}

variable "transit_encryption_enabled" {
  description = "TLS in-transit 暗号化。有効化するとクライアント側で TLS 設定が必要"
  type        = bool
  default     = false
}

variable "at_rest_encryption_enabled" {
  description = "at-rest 暗号化"
  type        = bool
  default     = true
}

variable "snapshot_retention_limit" {
  description = "自動 snapshot 保持日数。0 で snapshot 無効"
  type        = number
  default     = 0
}

variable "snapshot_window" {
  description = "snapshot 取得時間帯 (UTC, hh24:mi-hh24:mi)"
  type        = string
  default     = "17:00-18:00"
}

variable "maintenance_window" {
  description = "メンテナンス時間帯 (ddd:hh24:mi-ddd:hh24:mi)"
  type        = string
  default     = "sun:18:00-sun:19:00"
}

variable "apply_immediately" {
  description = "変更を即時適用するか。prd は false 推奨"
  type        = bool
  default     = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
