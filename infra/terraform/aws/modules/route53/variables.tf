variable "zone_id" {
  description = "A レコードを作成する Route 53 hosted zone ID"
  type        = string
}

variable "fqdn" {
  description = "作成する A レコードの FQDN (例: api.dev.nodebase.com)"
  type        = string
}

variable "alb_dns_name" {
  description = "Alias 先となる ALB の DNS 名"
  type        = string
}

variable "alb_zone_id" {
  description = "Alias 先となる ALB の zone ID"
  type        = string
}
