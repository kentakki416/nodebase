# =============================================================================
# A レコード (Alias) - 指定 FQDN → ALB
# =============================================================================
# ACM 証明書発行は modules/acm が担当する。本モジュールは
# 「ALB を指す DNS レコードを作る」責務のみに分離されている (循環参照回避)。

resource "aws_route53_record" "api" {
  zone_id = var.zone_id
  name    = var.fqdn
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
