output "cluster_id" {
  description = "ECS cluster ID"
  value       = aws_ecs_cluster.this.id
}

output "cluster_arn" {
  description = "ECS cluster ARN (workload modules から service / task の cluster 指定に使う)"
  value       = aws_ecs_cluster.this.arn
}

output "cluster_name" {
  description = "ECS cluster 名"
  value       = aws_ecs_cluster.this.name
}

output "task_execution_role_arn" {
  description = "Task execution role ARN (workload modules の execution_role_arn に渡す)"
  value       = aws_iam_role.task_execution.arn
}

output "task_execution_role_name" {
  description = "Task execution role 名 (env 側で追加 IAM policy を attach するときに使う)"
  value       = aws_iam_role.task_execution.name
}
