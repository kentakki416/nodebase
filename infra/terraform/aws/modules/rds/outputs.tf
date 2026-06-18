output "endpoint" {
  description = "RDS 接続エンドポイント (host:port 形式)"
  value       = aws_db_instance.this.endpoint
}

output "address" {
  description = "RDS ホスト名のみ"
  value       = aws_db_instance.this.address
}

output "port" {
  description = "Postgres ポート (デフォルト 5432)"
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "初期データベース名"
  value       = aws_db_instance.this.db_name
}

output "master_username" {
  description = "マスターユーザー名"
  value       = aws_db_instance.this.username
}

output "master_user_secret_arn" {
  description = "AWS 自動生成パスワードが保存されている Secrets Manager の ARN"
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}
