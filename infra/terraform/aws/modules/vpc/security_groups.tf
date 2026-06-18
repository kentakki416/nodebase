# =============================================================================
# Security Groups
# =============================================================================

locals {
  security_group_definitions = {
    for sg_name, sg in var.security_groups :
    sg_name => {
      name        = sg.name
      description = sg.description
    }
  }
}

resource "aws_security_group" "security_groups" {
  for_each    = local.security_group_definitions
  name        = each.value.name
  description = each.value.description
  vpc_id      = aws_vpc.vpc.id
  tags = {
    Name = "${var.name}-${each.key}"
  }
}

# =============================================================================
# Security Group Rules
# =============================================================================

resource "aws_security_group_rule" "security_group_rules" {
  for_each = {
    for rule in var.security_group_rules :
    "${rule.security_group_name}-${rule.type}-${rule.from_port}-${rule.to_port}-${rule.protocol}-${rule.cidr_blocks != null ? join(",", rule.cidr_blocks) : rule.source_security_group_name}" => rule
  }
  type                     = each.value.type
  from_port                = each.value.from_port
  to_port                  = each.value.to_port
  protocol                 = each.value.protocol
  description              = each.value.description
  security_group_id        = aws_security_group.security_groups[each.value.security_group_name].id
  cidr_blocks              = lookup(each.value, "cidr_blocks", null)
  source_security_group_id = each.value.source_security_group_name != null ? aws_security_group.security_groups[each.value.source_security_group_name].id : null
}
