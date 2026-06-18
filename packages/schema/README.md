# @repo/api-schema

API のリクエスト・レスポンススキーマを Zod で定義する共有パッケージです。

## 概要

- Zod スキーマによる API のバリデーションと TypeScript 型の自動生成
- API サーバー (`apps/api`) とフロントエンド (`apps/web`, `apps/admin`, `apps/mobile`) で共通利用

## ディレクトリ構成

```
src/
├── index.ts              # エントリポイント
└── api-schema/
    ├── index.ts          # スキーマの再エクスポート
    ├── auth.ts           # 認証関連スキーマ
    ├── health.ts         # ヘルスチェックスキーマ
    └── user.ts           # ユーザー関連スキーマ
```

## コマンド

```bash
pnpm build     # TypeScript をコンパイル
pnpm dev       # ウォッチモードで開発
pnpm lint      # ESLint 実行
pnpm lint:fix  # ESLint 自動修正
```

## 使い方

### スキーマの定義

`src/api-schema/` に Zod スキーマを定義し、`src/api-schema/index.ts` からエクスポートします。

### 他パッケージからのインポート

```typescript
import { SomeSchema, SomeType } from '@repo/api-schema'
```

## 命名規則

**パラメータ種別ごとに個別のスキーマを定義する**（共通スキーマは作らない。エンドポイントごとに独立した検証を行うため）。

| 種類 | 命名 | 例 |
|---|---|---|
| URL パラメータ（`/resource/:id` や `?foo=bar`） | `{action}{Domain}PathParamSchema` | `deleteMemoPathParamSchema` / `authGoogleCallbackPathParamSchema` |
| リクエストボディ（POST/PUT/PATCH） | `{action}{Domain}RequestSchema` | `createMemoRequestSchema` |
| レスポンス | `{action}{Domain}ResponseSchema` | `createMemoResponseSchema` |

- **型は `z.infer` で自動生成**し、手書きの interface は使わない
- **URL パラメータの ID 検証は `z.coerce.number().int().positive()`** で string → number の変換を Zod 側で行う（Controller で `Number()` しない）
- **すべてのリクエスト入力（body / params / query）は Zod で検証**する。`Number()` + `isNaN` や `parseInt` の inline 検証は使わない
- 一貫性のため例外を作らない。1 フィールドでも必ず Zod を通す

### ファイル構成

- API（エンドポイント）と 1 対 1 でファイルを作成する。アプリ固有のスキーマはサブディレクトリに分割する
  - 例: `api-schema/memo.ts`, `api-schema/admin/user.ts`
- Admin とアプリケーションでリクエスト・レスポンスが異なる場合、同じドメインでもアプリごとにファイルを分ける

### コメントスタイル

- `// ===...` でエンドポイントのセクション区切り
- `/** */` でスキーマ説明

```typescript
// ========================================================
// GET /api/memos - メモ一覧取得
// ========================================================

/**
 * メモ一覧取得のレスポンススキーマ
 */
export const getMemoListResponseSchema = z.object({ ... })
```

## 注意事項

- スキーマを変更した場合は `pnpm build` で再ビルドが必要です
- 新しい API エンドポイントを追加する際は、先にこのパッケージでスキーマを定義してください