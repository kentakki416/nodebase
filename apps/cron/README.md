# apps/cron

定期実行されるタスク群を 1 つの Node.js プロセスにまとめたパッケージ。

## タスク一覧

| コマンド | 用途 |
| --- | --- |
| `pnpm cleanup:old-memos` | 古い memo を一括削除する DB cleanup の例 |

## セットアップ

```bash
# ルートで一度だけ
pnpm install
pnpm --filter @repo/db db:generate
```

## 開発

```bash
# 起動確認 (src/index.ts を tsx watch)
pnpm dev

# 単発でタスクを実行（DATABASE_URL が必要）
DATABASE_URL=postgres://... pnpm cleanup:old-memos
```

## ビルド & 本番起動

```bash
pnpm build
DATABASE_URL=postgres://... node dist/task/cleanup-old-memos.js
```

Dockerfile はマルチステージで用意済み:

```bash
docker build -f apps/cron/Dockerfile -t nodebase-cron .
docker run --rm -e DATABASE_URL=... nodebase-cron
```

## 環境変数

| 変数 | 必須 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | `NODE_ENV !== "test"` のとき必須 | - | Prisma の接続文字列 |
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |
| `LOGGER_TYPE` | no | `pino` | `pino` / `winston` / `console` / `silent` |
| `LOG_LEVEL` | no | `info` | `debug` / `info` / `warn` / `error` |
| `CLEANUP_MEMO_OLDER_THAN_DAYS` | no | `90` | cleanup-old-memos が削除対象とする日数 |

## スケジュール（TODO）

スケジューラ側 (EventBridge / GitHub Actions / Kubernetes CronJob) の設定は本リポジトリにまだ含めていません。本番運用時は以下のいずれかで定期起動する想定:

- **AWS**: EventBridge Schedule → ECS Scheduled Task で `node dist/task/<name>.js` を起動
- **GitHub Actions**: `.github/workflows/cron-*.yml` で `schedule:` トリガーを設定し `pnpm --filter cron <task>` を実行
- **Kubernetes**: CronJob で `node dist/task/<name>.js`

## ディレクトリ構成

詳細は [`CLAUDE.md`](./CLAUDE.md) を参照。

```
apps/cron/
  src/
    index.ts                 # 起動確認用エントリポイント
    env.ts                   # Zod による env 検証
    task/                    # 1 ファイル = 1 cron タスク
    runtime/                 # graceful shutdown など
    repository/prisma/       # DB アクセス
  test/
  Dockerfile
```
