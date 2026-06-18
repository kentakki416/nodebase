# 機能仕様クイックリファレンス

このプロジェクトで実装されている / 設計中の機能の一覧です。各機能の詳細は `./{feature}/README.md` を参照してください。

このファイルは `design-feature` skill で新機能を設計するたびに更新されます。

## 機能一覧

| 機能名 | ステータス | 概要 | リンク |
|---|---|---|---|
| dev-login | 完了 | 開発環境専用ログイン。Google OAuth を介さず seed 済み dev ユーザー（alice/bob）として 1 クリックでログインできる | [./dev-login/README.md](./dev-login/README.md) |
| shared-packages | 完了 | api/cron/worker など複数 server-side app で共通利用するため、db/logger/errors/config/redis を `packages/` に切り出す（テンプレート整備） | [./shared-packages/README.md](./shared-packages/README.md) |
| nodebase-core | 設計中 | n8n クローンの中核。Workflow / Node / Edge / Credential / Execution + Manual & Webhook Trigger + HTTP Request & OpenAI ノードの MVP 設計 | [./nodebase-core/README.md](./nodebase-core/README.md) |

## ステータスの定義

- **設計中**: `docs/spec/{feature}/README.md` および `step*.md` を作成中。実装には未着手
- **実装中**: 設計が完了し、コードを実装中。一部の step が完了している場合もこのステータス
- **完了**: 全 step が実装され、テストが通っている

## 運用ルール

- 新機能を作るときは `design-feature` skill を使い、このファイルにエントリを必ず追加する
- ステータスが変わったらこのファイルも更新する
- 不要になった機能は削除し、過去の経緯を `docs/spec/{feature}/README.md` に記録してから機能ディレクトリ自体をアーカイブ（必要に応じて）
