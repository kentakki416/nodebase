output "primary_endpoint_address" {
  description = "Redis primary endpoint のホスト名"
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "port" {
  description = "Redis port (デフォルト 6379)"
  value       = aws_elasticache_replication_group.this.port
}
