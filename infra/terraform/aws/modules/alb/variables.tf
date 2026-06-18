# =============================================================================
# ALB Module Variables
# =============================================================================

variable "name" {
  description = "ALB name"
  type        = string
}

variable "internal" {
  description = "Whether ALB is internal"
  type        = bool
  default     = false
}

variable "security_groups" {
  description = "Security group IDs for ALB"
  type        = list(string)
}

variable "subnets" {
  description = "Subnet IDs for ALB"
  type        = list(string)
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "target_group_name_prefix" {
  description = "Target group 名のプレフィックス"
  type        = string
}

variable "target_group_port" {
  description = "Target group port"
  type        = number
  default     = 80
}

variable "target_group_protocol" {
  description = "Target group protocol"
  type        = string
  default     = "HTTP"
}

variable "target_type" {
  description = "Target type"
  type        = string
  default     = "ip"
}

variable "listener_port" {
  description = "Listener port"
  type        = string
  default     = "80"
}

variable "listener_protocol" {
  description = "Listener protocol"
  type        = string
  default     = "HTTP"
}

variable "health_check" {
  description = "Health check configuration"
  type = object({
    enabled             = bool
    healthy_threshold   = number
    interval            = number
    matcher             = string
    path                = string
    port                = string
    protocol            = string
    timeout             = number
    unhealthy_threshold = number
  })
  default = {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}

variable "enable_blue_green" {
  description = "Enable Blue/Green deployment support"
  type        = bool
  default     = false
}

variable "test_listener_port" {
  description = "Test listener port for Blue/Green deployment verification"
  type        = number
  default     = 9000
}

variable "idle_timeout" {
  description = "ALB の idle timeout (秒)。SSE 等の長時間接続を維持するため 3600 推奨。デフォルト 60"
  type        = number
  default     = 60
}

variable "enable_https" {
  description = "true で HTTPS listener (443) を作成する。plan 時に確定する bool で count を判定するため certificate_arn とは別フラグにしている"
  type        = bool
  default     = false
}

variable "certificate_arn" {
  description = "ACM 証明書 ARN。enable_https = true のときに HTTPS listener にアタッチする"
  type        = string
  default     = null
}

variable "ssl_policy" {
  description = "HTTPS listener の SSL policy"
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

variable "tags" {
  description = "Tags to apply to ALB resources"
  type        = map(string)
  default     = {}
}
