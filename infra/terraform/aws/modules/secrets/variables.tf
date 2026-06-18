variable "name" {
  description = "Secret 名 (例: /nodebase-dev/app)"
  type        = string
}

variable "initial_values" {
  description = "Secret に登録する key-value。ECS task definition の secrets: で個別キーを引く"
  type        = map(string)
  sensitive   = true
}

variable "recovery_window_in_days" {
  description = "削除時の復元猶予日数。0 で即時削除"
  type        = number
  default     = 7
}

variable "tags" {
  type    = map(string)
  default = {}
}
