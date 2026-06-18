output "fqdn" {
  description = "作成した A レコードの FQDN"
  value       = aws_route53_record.api.fqdn
}
