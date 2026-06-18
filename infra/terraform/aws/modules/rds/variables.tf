variable "name" {
  description = "RDS インスタンス識別子 (例: nodebase-dev-db)"
  type        = string
}

variable "engine_version" {
  description = "Postgres エンジンバージョン。AWS RDS でサポート中のバージョンを指定する (廃止 EOL バージョンは create 時に弾かれる)"
  type        = string
  default     = "16.6"
}

variable "instance_class" {
  description = "DB インスタンスクラス"
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  description = "初期ストレージ (GB)"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Auto-scaling 上限 (GB)。allocated_storage と同値なら auto-scaling 無効"
  type        = number
  default     = 100
}

variable "storage_type" {
  description = "ストレージタイプ (gp2 / gp3 / io1 / io2)。prd は高 IOPS の io1 / io2 を検討"
  type        = string
  default     = "gp3"
}

variable "db_name" {
  description = "初期データベース名 (Postgres 制約でアンダースコア可、ハイフン不可)"
  type        = string
}

variable "master_username" {
  description = "マスターユーザー名"
  type        = string
}

variable "subnet_ids" {
  description = "isolated subnet ID のリスト (最低 2 AZ)"
  type        = list(string)
}

variable "security_group_ids" {
  description = "RDS に付与する SG ID"
  type        = list(string)
}

variable "multi_az" {
  description = "Multi-AZ 配置を有効化するか (本番のみ true 推奨)"
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "自動バックアップの保持日数"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "自動バックアップ時間帯 (UTC, hh24:mi-hh24:mi)。env ごとにメンテと被らないよう設定"
  type        = string
  default     = "17:00-18:00"
}

variable "maintenance_window" {
  description = "メンテナンス時間帯 (ddd:hh24:mi-ddd:hh24:mi)。env ごとに無停止時間を避ける"
  type        = string
  default     = "sun:18:00-sun:19:00"
}

variable "performance_insights_enabled" {
  description = "Performance Insights を有効化するか"
  type        = bool
  default     = true
}

variable "performance_insights_retention_period" {
  description = "Performance Insights 保持期間 (日)。7 / 月単位 (31, 62, ...) / 最大 731"
  type        = number
  default     = 7
}

variable "auto_minor_version_upgrade" {
  description = "minor version の自動アップグレードを許可するか"
  type        = bool
  default     = true
}

variable "apply_immediately" {
  description = "変更を即時適用するか。prd は false (メンテ時間帯まで遅延) を推奨"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "誤削除防止フラグ。prd は true 推奨。dev は気軽に消すなら false"
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "destroy 時に最終スナップショットをスキップするか。dev は true で OK"
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}
