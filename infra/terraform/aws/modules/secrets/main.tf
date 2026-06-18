resource "aws_secretsmanager_secret" "this" {
  name                    = var.name
  description             = "Application secrets for ${var.name}"
  recovery_window_in_days = var.recovery_window_in_days

  tags = var.tags
}

# 初回 apply 時のみ initial_values を JSON 文字列として投入する。
# 以降は ignore_changes により Terraform は secret_string に触らないため、
# 残りの secret (GOOGLE_*, LIVEKIT_*, DATABASE_URL, REDIS_HOST, FRONTEND_URL 等) は
# Console / CLI / 別 script で追加・更新する運用となる。
# ECS task definition は valueFrom: <arn>:KEY:: の形で個別キーを引ける。
resource "aws_secretsmanager_secret_version" "this" {
  secret_id     = aws_secretsmanager_secret.this.id
  secret_string = jsonencode(var.initial_values)

  lifecycle {
    ignore_changes = [secret_string]
  }
}
