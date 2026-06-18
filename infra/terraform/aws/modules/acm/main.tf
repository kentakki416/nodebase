# =============================================================================
# ACM ワイルドカード証明書 + DNS 検証
# =============================================================================
# subdomain を指定すると *.<subdomain>.<domain> を、
# 空文字 ("") を渡すと *.<domain> をカバー (本番ドメイン直配置用)。

locals {
  wildcard_domain = var.subdomain == "" ? "*.${var.domain_name}" : "*.${var.subdomain}.${var.domain_name}"
}

resource "aws_acm_certificate" "wildcard" {
  domain_name       = local.wildcard_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = var.tags
}

# ACM が「ドメイン所有者である」ことを確認するための検証用 CNAME を Route 53 に自動投入する。
# - ACM が aws_acm_certificate.domain_validation_options で「このレコードを書いてくれ」と要求する値が入っている
# - そのレコードを実際に DNS に書くのが本リソースの役割
# - ACM が DNS を引いて期待値が返れば証明書が ISSUED になる
# - 複数ドメイン (SAN) に対応するため for_each でループ
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.wildcard.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.zone_id
}

# 検証用レコードを書き込んだあと、ACM が ISSUED 状態に遷移するまで plan/apply を待機させる。
# これを挟まないと、続く ALB の HTTPS listener が「未発行の証明書」を参照してエラーになる。
resource "aws_acm_certificate_validation" "wildcard" {
  certificate_arn         = aws_acm_certificate.wildcard.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}
