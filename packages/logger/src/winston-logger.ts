import { createLogger, format, transports } from "winston"

import { LOG_LEVEL, NODE_ENV } from "./const"
import { logContext } from "./context"
import type { ILogger, LogMetadata } from "./interface"

type NodeEnv = typeof NODE_ENV[keyof typeof NODE_ENV]

const { combine, timestamp, errors, json, simple, colorize } = format

/**
 * Winston Logger
 */
export class WinstonLogger implements ILogger {
  private _logger: ReturnType<typeof createLogger>

  constructor() {
    const env = (process.env.NODE_ENV || NODE_ENV.DEV) as NodeEnv
    const logLevel = env === NODE_ENV.PRD ? LOG_LEVEL.INFO : LOG_LEVEL.DEBUG

    /**
     * 開発環境: 可読性の高いフォーマット
     * 本番環境: JSON 形式（CloudWatch Logs などで処理しやすい）
     */
    const consoleFormat =
      env === NODE_ENV.PRD
        ? combine(errors({ stack: true }), timestamp(), json())
        : combine(errors({ stack: true }), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), colorize(), simple())

    this._logger = createLogger({
      exitOnError: false,
      format: combine(errors({ stack: true }), timestamp()),
      level: logLevel,
      transports: [
        /**
         * Console 出力（stdout/stderr）
         * クラウド環境では自動的に収集される
         */
        new transports.Console({
          format: consoleFormat,
        }),
      ],
    })
  }

  /**
   * コンテキスト（requestId, userId）を含むchild loggerを取得
   */
  private _getLogger(): ReturnType<typeof createLogger> {
    const context = logContext.getStore()
    if (context) {
      return this._logger.child(context)
    }
    return this._logger
  }

  public debug(message: string, metadata?: LogMetadata): void {
    this._getLogger().debug(message, metadata)
  }

  public info(message: string, metadata?: LogMetadata): void {
    this._getLogger().info(message, metadata)
  }

  public warn(message: string, metadata?: LogMetadata): void {
    this._getLogger().warn(message, metadata)
  }

  public error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (error) {
      this._getLogger().error(message, {
        error: error.message,
        stack: error.stack,
        ...metadata,
      })
    } else {
      this._getLogger().error(message, metadata)
    }
  }
}
