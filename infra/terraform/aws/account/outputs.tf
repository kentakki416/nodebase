# =============================================================================
# Account-scoped Outputs
# =============================================================================

# ECR
output "ecr_api_repository_url" {
  description = "API (nodebase-api-server) の ECR リポジトリ URL"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_worker_repository_url" {
  description = "matching-worker の ECR リポジトリ URL"
  value       = aws_ecr_repository.worker.repository_url
}

output "ecr_migration_repository_url" {
  description = "Prisma migration 用 ECR リポジトリ URL"
  value       = aws_ecr_repository.migration.repository_url
}

# GitHub Actions OIDC
output "github_actions_dev_role_arn" {
  description = "GitHub Actions dev 環境用 IAM ロールの ARN (GitHub Environments の dev → AWS_ROLE_ARN に登録)"
  value       = aws_iam_role.github_actions_dev.arn
}

output "github_actions_prd_role_arn" {
  description = "GitHub Actions prd 環境用 IAM ロールの ARN (GitHub Environments の prd → AWS_ROLE_ARN に登録)"
  value       = aws_iam_role.github_actions_prd.arn
}
