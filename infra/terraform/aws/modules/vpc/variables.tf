# =============================================================================
# VPC Module Variables
# =============================================================================

variable "name" {
  type        = string
  description = "VPC name"
}

variable "cidr_block" {
  type        = string
  description = "VPCのCIDRブロック"
}

variable "enable_dns_support" {
  type        = bool
  default     = true
  description = "DNSサポートを有効にするかどうか"
}

variable "enable_dns_hostnames" {
  type        = bool
  default     = true
  description = "DNSホスト名を有効にするかどうか"
}

variable "subnets" {
  type = map(object({
    cidr_block              = string
    availability_zone       = string
    subnet_type             = string # public or private
    route_tables            = optional(set(string), [])
    vpc_interface_endpoints = optional(set(string), [])
  }))
  default     = {}
  description = "subnetsを定義"
}

variable "create_internet_gateway" {
  type        = bool
  default     = true
  description = "インターネットゲートウェイを作成するかどうか"
}

variable "security_groups" {
  type = map(object({
    name        = string
    description = string
  }))
  default     = {}
  description = "security groupを定義"
}

variable "security_group_rules" {
  type = list(object({
    security_group_name        = string
    type                       = string
    from_port                  = number
    to_port                    = number
    protocol                   = string
    cidr_blocks                = optional(list(string), null)
    source_security_group_name = optional(string, null)
    description                = optional(string, null)
  }))
  default     = []
  description = "security group ruleを定義"
}

variable "create_nat_gateway" {
  description = "Whether to create NAT Gateway"
  type        = bool
  default     = false
}

variable "nat_gateway_subnet_key" {
  description = "NAT Gateway を配置する public subnet のキー"
  type        = string
  default     = null
}
