# =============================================================================
# Route Tables
# =============================================================================

# Route table for Internet Gateway
resource "aws_route_table" "route_table_igw" {
  count = var.create_internet_gateway ? 1 : 0

  vpc_id = aws_vpc.vpc.id
  tags = {
    Name = "${var.name}-igw-rt"
  }
}

# Route for Internet Gateway
resource "aws_route" "global_igw" {
  count = var.create_internet_gateway ? 1 : 0

  route_table_id         = aws_route_table.route_table_igw[count.index].id
  gateway_id             = aws_internet_gateway.igw[count.index].id
  destination_cidr_block = "0.0.0.0/0"
}

# Route table for NAT Gateway
resource "aws_route_table" "route_table_nat" {
  count = var.create_nat_gateway ? 1 : 0

  vpc_id = aws_vpc.vpc.id
  tags = {
    Name = "${var.name}-nat-rt"
  }
}

# Route for NAT Gateway
resource "aws_route" "global_nat" {
  count = var.create_nat_gateway ? 1 : 0

  route_table_id         = aws_route_table.route_table_nat[count.index].id
  nat_gateway_id         = aws_nat_gateway.nat[count.index].id
  destination_cidr_block = "0.0.0.0/0"
}

# パブリックサブネットをIGWルートテーブルに自動紐づけ
resource "aws_route_table_association" "public" {
  for_each = var.create_internet_gateway ? {
    for key, subnet in var.subnets : key => subnet if subnet.subnet_type == "public"
  } : {}

  subnet_id      = aws_subnet.subnets[each.key].id
  route_table_id = aws_route_table.route_table_igw[0].id
}

# プライベートサブネットをNATルートテーブルに自動紐づけ
resource "aws_route_table_association" "private" {
  for_each = var.create_nat_gateway ? {
    for key, subnet in var.subnets : key => subnet if subnet.subnet_type == "private"
  } : {}

  subnet_id      = aws_subnet.subnets[each.key].id
  route_table_id = aws_route_table.route_table_nat[0].id
}
