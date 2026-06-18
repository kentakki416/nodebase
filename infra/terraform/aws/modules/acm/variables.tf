variable "domain_name" {
  description = "ルートドメイン (例: nodebase.com)。証明書の SAN ではなく fqdn 構築用"
  type        = string
}

variable "subdomain" {
  description = "サブドメイン (例: dev)。空文字 \"\" を渡すと *.<domain> のワイルドカードを発行 (prd など apex 直配置用)。指定すると *.<subdomain>.<domain> を発行"
  type        = string
  default     = ""
}

variable "zone_id" {
  description = "DNS 検証レコードを書き込む Route 53 hosted zone ID"
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
