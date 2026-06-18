# =============================================================================
# NAT Gateway
# =============================================================================

resource "aws_nat_gateway" "nat" {
  count = var.create_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.subnets[var.nat_gateway_subnet_key].id

  tags = {
    Name = "${var.name}-nat"
  }

  depends_on = [aws_internet_gateway.igw]
}

# =============================================================================
# Elastic IP for NAT Gateway
# =============================================================================

resource "aws_eip" "nat" {
  count = var.create_nat_gateway ? 1 : 0

  domain = "vpc"

  tags = {
    Name = "${var.name}-nat-eip"
  }
}
