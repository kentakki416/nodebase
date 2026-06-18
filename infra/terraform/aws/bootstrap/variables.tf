# =============================================================================
# Bootstrap Variables
# =============================================================================

variable "project_name" {
  description = "プロジェクト名（S3バケット名のプレフィックスに使用）"
  type        = string
  default     = "nodebase" # TODO: プロジェクト名に変更してください
}

variable "aws_region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "s3_bucket_name" {
  description = "Terraform State保存用のS3バケット名（AWS全体でグローバルに一意である必要があります。他のAWSアカウントで既に使用されている名前は使用できません）"
  type        = string
  default     = "nodebase-terraform-state-20250101" # TODO: プロジェクト名、日付、UUIDなどを含めて一意のバケット名に変更してください
}
