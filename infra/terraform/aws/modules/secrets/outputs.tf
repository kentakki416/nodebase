output "secret_arn" {
  description = "Secret ARN (ECS task definition の valueFrom で参照)"
  value       = aws_secretsmanager_secret.this.arn
}

output "secret_name" {
  description = "Secret 名"
  value       = aws_secretsmanager_secret.this.name
}
