/**
 * ログメタデータの型定義
 */
export type LogMetadata = Record<string, unknown>

/**
 * Logger interface
 * 構造化ロギングのための共通インターフェース
 */
export interface ILogger {
  /**
   * デバッグレベルのログ
   */
  debug(message: string, metadata?: LogMetadata): void

  /**
   * 情報レベルのログ
   */
  info(message: string, metadata?: LogMetadata): void

  /**
   * 警告レベルのログ
   */
  warn(message: string, metadata?: LogMetadata): void

  /**
   * エラーレベルのログ
   * Error オブジェクトを渡すと、スタックトレースも記録される
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void
}
