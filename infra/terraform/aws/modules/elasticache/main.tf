resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

# default.redis7 を直接参照すると tflint がベストプラクティス警告を出すため、
# 中身ゼロの custom parameter group を作って同等の挙動にする。
# prd でチューニングするときは var.parameter_group_parameters に project を追加する。
resource "aws_elasticache_parameter_group" "this" {
  name   = "${var.name}-params"
  family = var.parameter_group_family
  tags   = var.tags

  dynamic "parameter" {
    for_each = var.parameter_group_parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }
}

# Redis replication group。
# - 1 ノード (primary only) でも replication group として作成しておくと
#   後から replica 追加・Multi-AZ 化が apply のみで可能になる
# - BullMQ は cluster mode 無効でも問題なく動作する
resource "aws_elasticache_replication_group" "this" {
  replication_group_id = var.name
  description          = "Redis for ${var.name}"

  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.this.name

  num_cache_clusters         = var.num_cache_clusters
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = var.security_group_ids

  transit_encryption_enabled = var.transit_encryption_enabled
  at_rest_encryption_enabled = var.at_rest_encryption_enabled

  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window          = var.snapshot_window
  maintenance_window       = var.maintenance_window

  apply_immediately = var.apply_immediately

  tags = var.tags
}
