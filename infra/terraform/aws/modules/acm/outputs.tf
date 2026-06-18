output "certificate_arn" {
  description = "検証完了済みの ACM 証明書 ARN（ALB の HTTPS listener にアタッチする）"
  value       = aws_acm_certificate_validation.wildcard.certificate_arn
}
