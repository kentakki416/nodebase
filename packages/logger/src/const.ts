/**
 * Logger 実装の種別
 * 環境変数 LOGGER_TYPE で選択される
 */
export const LOGGER_TYPE = {
  CONSOLE: "console",
  PINO: "pino",
  SILENT: "silent",
  WINSTON: "winston",
} as const

export type LoggerType = typeof LOGGER_TYPE[keyof typeof LOGGER_TYPE]

/**
 * Node の実行環境
 */
export const NODE_ENV = {
  DEV: "development",
  PRD: "production",
} as const

/**
 * ログレベル
 */
export const LOG_LEVEL = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const
