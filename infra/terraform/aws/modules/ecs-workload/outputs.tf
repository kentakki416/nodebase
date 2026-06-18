output "task_definition_arn" {
  description = "ECS task definition の ARN"
  value       = aws_ecs_task_definition.this.arn
}

output "task_definition_family" {
  description = "ECS task definition family 名 (RunTask 等で参照)"
  value       = aws_ecs_task_definition.this.family
}

output "service_name" {
  description = "ECS service 名 (create_service = false なら null)"
  value       = var.create_service ? aws_ecs_service.this[0].name : null
}

output "log_group_name" {
  description = "CloudWatch Logs の log group 名"
  value       = aws_cloudwatch_log_group.this.name
}

output "deploy_approval_parameter_name" {
  description = "Blue/Green 承認用 SSM パラメータ名 (enable_blue_green = true のときのみ)"
  value       = var.enable_blue_green ? aws_ssm_parameter.deploy_approval[0].name : null
}
