# =============================================================================
# Subnets
# =============================================================================

resource "aws_subnet" "subnets" {
  for_each          = var.subnets
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = each.value.cidr_block
  availability_zone = each.value.availability_zone
  tags = {
    Name       = "${var.name}-${each.key}"
    SubnetType = each.value.subnet_type
  }
}
