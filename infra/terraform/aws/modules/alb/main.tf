# =============================================================================
# Application Load Balancer Resources
# =============================================================================

# Application Load Balancer
resource "aws_lb" "main" {
  name               = var.name
  internal           = var.internal
  load_balancer_type = "application"
  security_groups    = var.security_groups
  subnets            = var.subnets

  enable_deletion_protection = var.enable_deletion_protection

  drop_invalid_header_fields = true

  # SSE / WebSocket 等の長時間接続を維持するため env 側で 3600 に伸ばす
  idle_timeout = var.idle_timeout

  tags = var.tags
}

/**
 * ALB Target Group (a / b)
 */
resource "aws_lb_target_group" "a" {
  name        = "${var.target_group_name_prefix}-tg-a"
  port        = var.target_group_port
  protocol    = var.target_group_protocol
  vpc_id      = var.vpc_id
  target_type = var.target_type

  health_check {
    enabled             = var.health_check.enabled
    healthy_threshold   = var.health_check.healthy_threshold
    interval            = var.health_check.interval
    matcher             = var.health_check.matcher
    path                = var.health_check.path
    port                = var.health_check.port
    protocol            = var.health_check.protocol
    timeout             = var.health_check.timeout
    unhealthy_threshold = var.health_check.unhealthy_threshold
  }

  tags = var.tags
}

resource "aws_lb_target_group" "b" {
  count = var.enable_blue_green ? 1 : 0

  name        = "${var.target_group_name_prefix}-tg-b"
  port        = var.target_group_port
  protocol    = var.target_group_protocol
  vpc_id      = var.vpc_id
  target_type = var.target_type

  health_check {
    enabled             = var.health_check.enabled
    healthy_threshold   = var.health_check.healthy_threshold
    interval            = var.health_check.interval
    matcher             = var.health_check.matcher
    path                = var.health_check.path
    port                = var.health_check.port
    protocol            = var.health_check.protocol
    timeout             = var.health_check.timeout
    unhealthy_threshold = var.health_check.unhealthy_threshold
  }

  tags = var.tags
}

# ALB HTTP Listener
resource "aws_lb_listener" "main" {
  count = var.enable_https ? 0 : 1 # enable_https = trueならば作成しない

  load_balancer_arn = aws_lb.main.arn
  port              = var.listener_port
  protocol          = var.listener_protocol

  /**
   * default_action は環境ごとに切り替える:
   * - enable_blue_green = true  : priority=1 の `/*` ルールが全リクエストを吸う設計のため、
   *   default は到達しない fallback として 503 を返す。ルール消失時の事故防止。
   *   ECS Native Blue/Green が書き換えるのは listener rule の forward action のみで、
   *   default_action は触らないため ignore_changes は不要。
   * - enable_blue_green = false : listener rule を持たないので default が全リクエストを処理。
   *   target group A に forward する。
   */
  dynamic "default_action" {
    for_each = var.enable_blue_green ? [1] : []
    content {
      type = "fixed-response"
      fixed_response {
        content_type = "text/plain"
        message_body = "Service Unavailable"
        status_code  = "503"
      }
    }
  }

  dynamic "default_action" {
    for_each = var.enable_blue_green ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.a.arn
    }
  }
}

# HTTP Listener Rule for Blue/Green deployment
resource "aws_lb_listener_rule" "production" {
  count = var.enable_blue_green && !var.enable_https ? 1 : 0 # enable_https = trueならば作成しない

  listener_arn = aws_lb_listener.main[0].arn
  priority     = 1

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  action {
    type = "forward"
    forward {
      target_group {
        arn    = aws_lb_target_group.a.arn
        weight = 100
      }
      target_group {
        arn    = aws_lb_target_group.b[0].arn
        weight = 0
      }
    }
  }

  # ECSがデプロイ時にactionの重みを変更するため、差分を無視
  lifecycle {
    ignore_changes = [action]
  }
}

# =============================================================================
# HTTPS Listener (enable_https = true のときのみ)
# =============================================================================

resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = var.ssl_policy
  certificate_arn   = var.certificate_arn

  /**
   * default_action は環境ごとに切り替える (HTTP listener と同じ方針):
   * - enable_blue_green = true  : 503 fallback (listener rule が全リクエストを吸う)
   * - enable_blue_green = false : target group A に forward (listener rule なし)
   */
  dynamic "default_action" {
    for_each = var.enable_blue_green ? [1] : []
    content {
      type = "fixed-response"
      fixed_response {
        content_type = "text/plain"
        message_body = "Service Unavailable"
        status_code  = "503"
      }
    }
  }

  dynamic "default_action" {
    for_each = var.enable_blue_green ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.a.arn
    }
  }

  lifecycle {
    precondition {
      condition     = var.certificate_arn != null
      error_message = "enable_https = true のときは certificate_arn の指定が必須です。"
    }
  }
}

# HTTPS 用の production listener rule
resource "aws_lb_listener_rule" "production_https" {
  count = var.enable_blue_green && var.enable_https ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 1

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  action {
    type = "forward"
    forward {
      target_group {
        arn    = aws_lb_target_group.a.arn
        weight = 100
      }
      target_group {
        arn    = aws_lb_target_group.b[0].arn
        weight = 0
      }
    }
  }

  # ECS がデプロイ時に action の weight を変更するため、差分を無視
  lifecycle {
    ignore_changes = [action]
  }
}

# =============================================================================
# Test Listener (Blue/Green deployment)
# =============================================================================

# テスト用リスナー
# - デプロイ中にGreen環境をポート9000経由で事前検証するためのリスナー
# - Web/Mobileから http://<ALB_DNS>:9000 でGreen環境にアクセス可能
resource "aws_lb_listener" "test" {
  count = var.enable_blue_green ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = var.test_listener_port
  protocol          = var.listener_protocol

  /**
   * default_action は priority=1 の `/*` ルールにマッチしなかった想定外パス向けの fallback。
   * 通常は priority=1 が全リクエストを吸うので到達しないが、ルール消失時の事故を防ぐため
   * 明示的に 503 を返す。
   * ECS Native Blue/Green が書き換えるのは listener rule の forward action のみで、
   * default_action は触らないため ignore_changes は不要。
   */
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Service Unavailable"
      status_code  = "503"
    }
  }
}

# テスト用リスナールール
# - ECSのadvanced_configuration.test_listener_ruleに渡すルール
# - デプロイ中にECSがこのルールを制御してGreen TGにテストトラフィックをルーティング
resource "aws_lb_listener_rule" "test" {
  count = var.enable_blue_green ? 1 : 0

  listener_arn = aws_lb_listener.test[0].arn
  priority     = 1

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.b[0].arn
  }

  # ECSがデプロイ時にactionを変更するため、差分を無視
  lifecycle {
    ignore_changes = [action]
  }
}
