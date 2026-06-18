# =============================================================================
# Bootstrap Outputs
# =============================================================================

# Terraform State
output "s3_bucket_name" {
  description = "Terraform State 保存用の S3 バケット名 (State lock は同バケットの use_lockfile で取得する)"
  value       = aws_s3_bucket.terraform_state.id
}

output "aws_region" {
  description = "AWS リージョン"
  value       = var.aws_region
}
