import { logger } from "@repo/logger"

/**
 * apps/cron のデフォルトエントリポイント。
 *
 * 実際の定期実行タスクは `src/task/<name>.ts` に 1 ファイル = 1 task で配置する:
 *   - `pnpm cleanup:old-memos`  : 古い memo を一括削除（DB cleanup の例）
 *
 * このファイルは `pnpm dev` で起動した際の起動確認用。
 * 本番では起動されない（ECS Scheduled Task 等は `pnpm <task>` を直接呼ぶ想定）。
 */
const main = (): void => {
  logger.info("cron package booted", { env: process.env.NODE_ENV ?? "local" })
}

main()
