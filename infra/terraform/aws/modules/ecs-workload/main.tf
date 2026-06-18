data "aws_region" "current" {}

# =============================================================================
# CloudWatch Log Group (per-workload)
# =============================================================================

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_in_days
  tags              = var.tags
}

# =============================================================================
# ECS Task Definition
# =============================================================================
# - secrets[] は Secrets Manager の特定キーを valueFrom: <arn>:KEY:: で個別注入
# - portMappings は container_port が指定されたときのみ
# - command は与えられたら Dockerfile の CMD を上書き
# - deploy(CD) は describe-task-definition で latest を取って image を SHA に差し替えて
#   別リビジョンとして再 register する設計。
# - terraform applyでtask-definition(latest参照)が新しく作られても、ecs-service側のignore_chagesにより、
#   実行コンテナは変わらない

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.cpu)
  memory                   = tostring(var.memory)
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn != null ? var.task_role_arn : var.execution_role_arn

  container_definitions = jsonencode([
    merge(
      {
        name      = var.name
        image     = var.image
        essential = true

        environment = [
          for k, v in var.environment : { name = k, value = v }
        ]

        secrets = var.secrets_arn != null ? [
          for k in var.secret_keys : {
            name      = k
            valueFrom = "${var.secrets_arn}:${k}::"
          }
        ] : []

        logConfiguration = {
          logDriver = "awslogs"
          options = {
            awslogs-group         = aws_cloudwatch_log_group.this.name
            awslogs-region        = data.aws_region.current.id
            awslogs-stream-prefix = "ecs"
          }
        }
      },
      var.container_port != null ? {
        portMappings = [{
          containerPort = var.container_port
          protocol      = "tcp"
        }]
      } : {},
      var.command != null ? { command = var.command } : {},
    ),
  ])

  tags = var.tags
}

# =============================================================================
# ECS Service (create_service = true のとき)
# =============================================================================

/**
 * service create / replace 時に最新の task_definition revision を解決するための data source。
 * Terraform 側の aws_ecs_task_definition.this は state 上 rev:N のまま固定されるが、
 * CI が deploy のたびに register-task-definition で新リビジョンを積む。その結果、
 * service を replace するとき HCL 側参照 (rev:N) で作ってしまい古い image に巻き戻ってしまう。
 * data source 経由で family の最新 active revision を都度引き直すことでこの巻き戻りを防ぐ。
 *
 * depends_on で aws_ecs_task_definition.this の create を待ち、初回 apply でも最新を返す。
 */
data "aws_ecs_task_definition" "current" {
  count = var.create_service ? 1 : 0

  task_definition = aws_ecs_task_definition.this.family

  depends_on = [aws_ecs_task_definition.this]
}

resource "aws_ecs_service" "this" {
  count = var.create_service ? 1 : 0

  name            = var.name
  cluster         = var.cluster_arn
  task_definition = data.aws_ecs_task_definition.current[0].arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnets
    security_groups  = var.security_groups
    assign_public_ip = var.assign_public_ip
  }

  # 通常モード (Blue/Green 無効) の ALB 連携
  dynamic "load_balancer" {
    for_each = !var.enable_blue_green && var.target_group_arn != null ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = var.name
      container_port   = var.container_port
    }
  }

  # Blue/Green モードの ALB 連携 (advanced_configuration 込み)
  dynamic "load_balancer" {
    for_each = var.enable_blue_green && var.target_group_arn != null ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = var.name
      container_port   = var.container_port

      advanced_configuration {
        alternate_target_group_arn = var.alternate_target_group_arn
        production_listener_rule   = var.production_listener_rule_arn # ユーザートラフィック用のリスナーarn
        test_listener_rule         = var.test_listener_rule_arn       # 車内確認トラフィック用のリスナーarn
        role_arn                   = aws_iam_role.ecs_alb_service[0].arn
      }
    }
  }

  # Blue/Green デプロイメント設定
  dynamic "deployment_configuration" {
    for_each = var.enable_blue_green ? [1] : []
    content {
      strategy             = "BLUE_GREEN"
      bake_time_in_minutes = var.bake_time_in_minutes

      lifecycle_hook {
        hook_target_arn  = aws_lambda_function.deployment_hook[0].arn
        lifecycle_stages = ["POST_TEST_TRAFFIC_SHIFT"]
        role_arn         = aws_iam_role.ecs_lifecycle_hook[0].arn
      }
    }
  }

  # 通常モードのローリング更新レンジ (Blue/Green 時は AWS 側で別管理)
  deployment_minimum_healthy_percent = var.enable_blue_green ? null : 50
  deployment_maximum_percent         = var.enable_blue_green ? null : 200

  # 壊れたtask definitionの無限リトライを防止
  dynamic "deployment_circuit_breaker" {
    for_each = var.enable_blue_green ? [] : [1] # blue/greenデプロイ時には不要なせって
    content {
      enable   = true # 1０回リトライしたらfail扱いにする
      rollback = true # failになったら正常に稼働していたリビジョンにロールバックする
    }
  }

  tags = var.tags

  /**
   * CI が deploy 時に register-task-definition で新リビジョンを作って update-service するため、
   * Terraform はその後の task_definition pointer を巻き戻さない。
   * Terraform 側で task definition の中身を変更した場合は、次回 CI デプロイ時に最新リビジョンを
   * ベースに新リビジョンが作られて service に反映される。
   */
  lifecycle {
    ignore_changes = [task_definition]
  }
}

# =============================================================================
# Blue/Green: ALB Service Role (ECS がターゲットグループを操作するため)
# =============================================================================

data "aws_iam_policy" "ecs_infrastructure_lb" {
  count = var.enable_blue_green ? 1 : 0
  name  = "AmazonECSInfrastructureRolePolicyForLoadBalancers"
}

resource "aws_iam_role" "ecs_alb_service" {
  count = var.enable_blue_green ? 1 : 0
  name  = "${var.name}-alb-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ecs_alb_service" {
  count      = var.enable_blue_green ? 1 : 0
  role       = aws_iam_role.ecs_alb_service[0].name
  policy_arn = data.aws_iam_policy.ecs_infrastructure_lb[0].arn
}

# =============================================================================
# Blue/Green: SSM Parameter (deploy approval flag)
# =============================================================================
# 承認: aws ssm put-parameter --name "<param>" --value "approved" --overwrite
# 拒否: aws ssm put-parameter --name "<param>" --value "rejected" --overwrite

resource "aws_ssm_parameter" "deploy_approval" {
  count = var.enable_blue_green ? 1 : 0

  name  = "/${var.name}/deploy/approval"
  type  = "String"
  value = "pending"

  lifecycle {
    ignore_changes = [value]
  }

  tags = var.tags
}

# =============================================================================
# Blue/Green: Lambda function (POST_TEST_TRAFFIC_SHIFT 時に承認を待つ)
# =============================================================================

data "archive_file" "deployment_hook" {
  count       = var.enable_blue_green ? 1 : 0
  type        = "zip"
  source_file = "${path.module}/lambda/deployment_hook.mjs"
  output_path = "${path.module}/lambda/deployment_hook.zip"
}

data "aws_iam_policy" "lambda_basic_execution" {
  count = var.enable_blue_green ? 1 : 0
  name  = "AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role" "lambda_deployment_hook" {
  count = var.enable_blue_green ? 1 : 0
  name  = "${var.name}-deployment-hook-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  count      = var.enable_blue_green ? 1 : 0
  role       = aws_iam_role.lambda_deployment_hook[0].name
  policy_arn = data.aws_iam_policy.lambda_basic_execution[0].arn
}

resource "aws_iam_role_policy" "lambda_ssm" {
  count = var.enable_blue_green ? 1 : 0
  name  = "ssm-deploy-approval"
  role  = aws_iam_role.lambda_deployment_hook[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter", "ssm:PutParameter"]
      Resource = aws_ssm_parameter.deploy_approval[0].arn
    }]
  })
}

resource "aws_lambda_function" "deployment_hook" {
  count = var.enable_blue_green ? 1 : 0

  function_name = "${var.name}-deployment-hook"
  role          = aws_iam_role.lambda_deployment_hook[0].arn
  handler       = "deployment_hook.handler"
  runtime       = "nodejs22.x"
  timeout       = 30

  filename         = data.archive_file.deployment_hook[0].output_path
  source_code_hash = data.archive_file.deployment_hook[0].output_base64sha256

  environment {
    variables = {
      APPROVAL_PARAMETER_NAME = aws_ssm_parameter.deploy_approval[0].name
    }
  }

  tags = var.tags
}

# =============================================================================
# Blue/Green: ECS lifecycle hook IAM role (ECS が Lambda を呼ぶため)
# =============================================================================

resource "aws_iam_role" "ecs_lifecycle_hook" {
  count = var.enable_blue_green ? 1 : 0
  name  = "${var.name}-lifecycle-hook"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs.amazonaws.com"
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "ecs_invoke_lambda" {
  count = var.enable_blue_green ? 1 : 0
  name  = "invoke-deployment-hook-lambda"
  role  = aws_iam_role.ecs_lifecycle_hook[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.deployment_hook[0].arn
    }]
  })
}
