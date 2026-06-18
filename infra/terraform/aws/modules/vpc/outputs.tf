# =============================================================================
# VPC Module Outputs
# =============================================================================

output "vpc_id" {
  value       = aws_vpc.vpc.id
  description = "VPC ID"
}

output "igw_route_table_id" {
  value       = var.create_internet_gateway ? aws_route_table.route_table_igw[0].id : null
  description = "Internet Gateway Route Table ID"
}

output "security_group_ids" {
  value = {
    for sg_name, sg in aws_security_group.security_groups : sg_name => sg.id
  }
  description = "value = { for sg_name, sg in aws_security_group.security_groups : sg_name => sg.id }"
}

output "subnets" {
  value = {
    for key, subnet in aws_subnet.subnets :
    key => {
      id   = subnet.id
      cidr = subnet.cidr_block
      az   = subnet.availability_zone
    }
  }
}

output "security_groups" {
  value = {
    for key, sg in aws_security_group.security_groups :
    key => {
      id          = sg.id
      name        = sg.name
      description = sg.description
    }
  }
}

output "nat_gateway_id" {
  description = "The ID of the NAT Gateway"
  value       = var.create_nat_gateway ? aws_nat_gateway.nat[0].id : null
}

output "nat_gateway_public_ip" {
  description = "The public IP address of the NAT Gateway"
  value       = var.create_nat_gateway ? aws_eip.nat[0].public_ip : null
}

output "nat_route_table_id" {
  description = "The ID of the NAT Gateway route table"
  value       = var.create_nat_gateway ? aws_route_table.route_table_nat[0].id : null
}
