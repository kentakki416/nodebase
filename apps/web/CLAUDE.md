# apps/web

Next.js 16 (App Router) の web アプリケーション（port 3000）。Tailwind CSS v4 + PostCSS。

## Commands

```bash
pnpm dev          # http://localhost:3000 で起動
pnpm build        # 本番ビルド
pnpm start        # 本番サーバー起動
```

## アーキテクチャ

- App Router 構成: `src/app/` 配下
- 型・スキーマは `@repo/api-schema` から import（**ローカル独自定義は禁止**：API 側の変更に追従できず型不整合バグが発生するため）

## API 通信ルール

**ブラウザから直接 Express API を fetch しない**。必ずサーバーサイドを経由してサーバー間通信する。

### データ取得（GET）

- **基本**: Server Component で `apiClient.get()` → Express API
- **Client Component から動的に取得が必要な場合**（タブ切替、検索等）: Route Handler (`app/api/*/route.ts`) を作成し、Client Component から fetch する

### データ変更（POST/PUT/DELETE）

- **基本**: Server Action (`"use server"`) → Express API。フォーム送信やボタンクリックによる CRUD 操作に使用
- **Server Action が適さない場合**（ファイルアップロード、外部公開 API 等）: Route Handler を使用

### 禁止事項

- **Server Action をデータ取得（GET 相当）に使ってはならない**。Server Action は mutation 専用。データ取得には Server Component または Route Handler を使う

### Server Action の配置

対応するページと同じディレクトリに `actions.ts` として配置する（例: `app/(dashboard)/categories/actions.ts`）。`app/actions/` のような共通ディレクトリには置かない。

## 動作確認（必須）

UI コード（`page.tsx` / Client Component / Server Action / 認証フロー等）を**実装・修正したら必ず Playwright MCP で実画面の動作確認**を行う。`pnpm build` の通過は型・ルート登録のチェックでしかなく、レンダリング不具合・hydration error・コンソールエラー・認証フローの動作は検出できない。

最低限の確認:
- `mcp__playwright__browser_navigate` で目的の URL のまま着地している（middleware による `/sign-in` リダイレクトに気付かず OK 判定しない）
- `mcp__playwright__browser_console_messages` の `level: "error"` が 0 件
- `mcp__playwright__browser_snapshot` で意図した要素（見出し / フォーム項目 / アクションボタン）が表示される

認証必須ページの検証は `pnpm --filter api issue-test-token <userId>` で発行した JWT を `app_access_token` / `app_refresh_token` cookie に注入する。手順は `verify-web-page` skill にまとめてあるので、UI 実装直後に自発的に呼び出すこと。

`pnpm build` だけで「動作確認済み」と報告するのは禁止。

## PR 作成時の before/after スクショ（必須）

**見た目に影響する Web の PR は、PR 本文に before/after スクリーンショットを必ず含める**。レビュアーが画面の変化を即座に把握できるようにするため。

ルール:
- 保存先: `docs/screenshots/{feature}/{before,after}.png`（`{feature}` は kebab-case の短い識別子）
- **既存ページ修正**: ブランチを切る前に main で before を撮る → 実装後に after を撮る → 両方コミット
- **新規ページ作成**: after のみで OK（PR 本文に「新規ページのため before なし」と明記）
- **見た目に影響しないリファクタ / 裏側変更 / docs のみ**: 不要（PR 本文に「UI 変更なし」と明記）
- 画像は **git に commit & push が必要**（`gh` の API では PR 本文用の画像 CDN へ直接アップロードできないため）
- **PR 本文では相対パスは表示されない**。必ず絶対 URL `https://github.com/<owner>/<repo>/raw/<branch>/docs/screenshots/{feature}/{before,after}.png` を使う

before の撮り忘れ対策: `git stash` → `git checkout main` → 撮影 → `git checkout <branch>` → `git stash pop` で後からでも復元できる。

詳細手順とテンプレ markdown は `verify-web-page` skill を参照。
