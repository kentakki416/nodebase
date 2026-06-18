# apps/admin

Next.js 16 (App Router) の admin ダッシュボード（port 3030）。Tailwind CSS v4 + PostCSS。

## Commands

```bash
pnpm dev          # http://localhost:3030 で起動
pnpm build        # 本番ビルド
pnpm start        # 本番サーバー起動
```

## アーキテクチャ

`apps/web` と同じ App Router / API 通信ルールに従う（詳細は `apps/web/CLAUDE.md` を参照）。Admin 固有の方針のみここに記載する。

- 型・スキーマは `@repo/api-schema/admin/` から import（Admin 固有のレスポンスが必要な場合）
- Admin 向け API は `/api/admin/` 配下を呼び出す（API 側の方針は `apps/api/CLAUDE.md` の "Admin API 設計方針" 参照）

## ダミーモード

API 側で `ADMIN_USE_DUMMY=true`（`apps/api/.env.local`）を設定すると DB なしでダミーデータが返るため、フロント開発時に活用する。

## 動作確認（必須）

UI コードを実装・修正したら **必ず Playwright MCP で実画面の動作確認** を行う（詳細は `apps/web/CLAUDE.md` の「動作確認（必須）」セクションを参照）。port は 3030。`pnpm build` だけで「動作確認済み」と報告するのは禁止。

## PR 作成時の before/after スクショ（必須）

見た目に影響する Admin の PR も `docs/screenshots/{feature}/{before,after}.png` を PR 本文に含める（詳細は `apps/web/CLAUDE.md` の「PR 作成時の before/after スクショ（必須）」セクションを参照）。
