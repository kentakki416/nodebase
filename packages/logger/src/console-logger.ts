/* eslint-disable no-console */
import { logContext } from "./context"
import type { ILogger, LogMetadata } from "./interface"

/**
 * Console Logger
 */
export class ConsoleLogger implements ILogger {
  private _formatLog(level: string, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString()
    const context = logContext.getStore()

    const baseLog = {
      level,
      message,
      timestamp,
      ...context, // requestId, userIdを含める
    }

    if (metadata && Object.keys(metadata).length > 0) {
      return JSON.stringify({ ...baseLog, ...metadata })
    }

    return JSON.stringify(baseLog)
  }

  public debug(message: string, metadata?: LogMetadata): void {
    console.log(this._formatLog("debug", message, metadata))
  }

  public info(message: string, metadata?: LogMetadata): void {
    console.log(this._formatLog("info", message, metadata))
  }

  public warn(message: string, metadata?: LogMetadata): void {
    console.warn(this._formatLog("warn", message, metadata))
  }

  public error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (error) {
      const errorMetadata = {
        error: error.message,
        stack: error.stack,
        ...metadata,
      }
      console.error(this._formatLog("error", message, errorMetadata))
    } else {
      console.error(this._formatLog("error", message, metadata))
    }
  }
}
