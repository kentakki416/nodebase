# =============================================================================
# ALB Module Outputs
# =============================================================================

output "alb_id" {
  description = "ALB ID"
  value       = aws_lb.main.id
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB zone ID"
  value       = aws_lb.main.zone_id
}

output "target_group_a_arn" {
  description = "Target group A ARN。初期状態では本番 listener (production_listener_rule) にバインドされる側"
  value       = aws_lb_target_group.a.arn
}

output "target_group_b_arn" {
  description = "Target group B ARN。初期状態では alternate (test_listener_rule) にバインドされ、デプロイ時に CodeDeploy が役割を a と入れ替える"
  value       = var.enable_blue_green ? aws_lb_target_group.b[0].arn : null
}

output "listener_arn" {
  description = "Listener ARN (HTTP)。enable_https=true の構成では HTTP listener を作らないので null を返す。"
  value       = var.enable_https ? null : aws_lb_listener.main[0].arn
}

output "https_listener_arn" {
  description = "HTTPS Listener ARN (enable_https = true のときのみ)"
  value       = var.enable_https ? aws_lb_listener.https[0].arn : null
}

output "listener_rule_arn" {
  description = "Production listener rule ARN for Blue/Green deployment. HTTPS が有効ならそちら、無効なら HTTP rule を返す。ECS service の advanced_configuration.production_listener_rule に渡す。"
  value = var.enable_blue_green ? (
    var.enable_https
    ? aws_lb_listener_rule.production_https[0].arn
    : aws_lb_listener_rule.production[0].arn
  ) : null
}

output "test_listener_rule_arn" {
  description = "Test listener rule ARN for Blue/Green deployment verification"
  value       = var.enable_blue_green ? aws_lb_listener_rule.test[0].arn : null
}
