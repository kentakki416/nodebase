# =============================================================================
# ECS Fargate Cluster
# =============================================================================

resource "aws_ecs_cluster" "this" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = var.container_insights_enabled ? "enabled" : "disabled"
  }

  tags = var.tags
}

# =============================================================================
# Task Execution Role (cluster 共通)
# =============================================================================
# 全 workload (API / worker / migration / 将来追加) が共有する。
# ECR pull / CloudWatch Logs / 後から env 側で追加 attach する Secrets Manager 等を担う。

data "aws_iam_policy" "ecs_task_execution" {
  name = "AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task_execution" {
  name = "${var.name}-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = data.aws_iam_policy.ecs_task_execution.arn
}

# Secrets Manager GetSecretValue 権限 (workload で override する想定がないため cluster で一元管理)
# 一覧は secret_arns_readable で env 側から渡す
resource "aws_iam_role_policy" "secrets_access" {
  count = length(var.secret_arns_readable) > 0 ? 1 : 0

  name = "${var.name}-secrets-access"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = var.secret_arns_readable
      },
    ]
  })
}
