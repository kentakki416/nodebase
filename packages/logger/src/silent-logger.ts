import type { ILogger, LogMetadata } from "./interface"

/**
 * Silent Logger
 * 何も出力しないロガー。テスト時にログノイズを抑制するために使用
 */
export class SilentLogger implements ILogger {
  public debug(_message: string, _metadata?: LogMetadata): void {
    /* noop */
  }

  public info(_message: string, _metadata?: LogMetadata): void {
    /* noop */
  }

  public warn(_message: string, _metadata?: LogMetadata): void {
    /* noop */
  }

  public error(_message: string, _error?: Error, _metadata?: LogMetadata): void {
    /* noop */
  }
}
