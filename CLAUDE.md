# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turborepo + pnpm モノレポ。

### Apps

- **apps/web**: Next.js 16 web application (port 3000)
- **apps/admin**: Next.js 16 admin dashboard (port 3030)
- **apps/mobile**: Expo/React Native mobile application
- **apps/api**: Express.js API server (port 8080)
- **apps/cron**: 定期実行タスク（タスク 1 回実行で exit するモデル。本番は EventBridge / CronJob 等で起動）
- **apps/worker**: 常駐型 worker（BullMQ ベース。Queue 実装は `@repo/queue` の抽象越しに DI されており、SQS / Cloud Tasks 等への差し替えが容易）

### Packages

- **packages/schema**: Shared Zod schemas (`@repo/api-schema`)
- **packages/db**: Prisma schema / migrations / generated client + `createPrismaClient` factory (`@repo/db`)
- **packages/logger**: `ILogger` + pino/winston/console/silent + AsyncLocalStorage context (`@repo/logger`)
- **packages/errors**: `Result<T>` + `ApiError` + 業務エラー生成ヘルパ (`@repo/errors`)
- **packages/redis**: `createRedisClient` factory（BullMQ / Pub/Sub 対応）(`@repo/redis`)
- **packages/queue**: Queue 抽象 (`JobQueue<T>` / `JobProcessor<T>` / `JobConsumer`) + BullMQ 実装 + Job 型 (`@repo/queue`)。ハンドラ側は実装を knows せず、別 queue 実装への切り替えが可能

共通パッケージの設計詳細は [`docs/spec/shared-packages/`](docs/spec/shared-packages/README.md) を参照。新規 server-side app (cron / worker / batch) を追加する場合は同設計書に沿って `@repo/db` / `@repo/logger` / `@repo/errors` / `@repo/redis` を依存に追加し、各 app の `src/index.ts` で client を生成して Repository に DI する。

**環境変数の検証は各 app の `src/env.ts` にインラインで定義する**（Zod スキーマ + `safeParse → process.exit(1)`）。共通の env 検証パッケージは持たず、app ごとに必要な env を直接宣言することで、`apps/{app}/src/env.ts` 単独で env 仕様が完結する。Next.js 側（`apps/web` / `apps/admin`）は `server-only` でガードして client component からの import を防ぐ。

### Infra

- **infra/terraform**: AWS Infrastructure as Code

### CLAUDE.md の参照

各ディレクトリでの作業時は **対応する `CLAUDE.md` を参照してください**:

- API → `apps/api/CLAUDE.md`（レイヤードアーキテクチャ / Result型 / テスト戦略 / dotenvx / Admin方針 / DI assembly）
- Web → `apps/web/CLAUDE.md`
- Admin → `apps/admin/CLAUDE.md`
- Mobile → `apps/mobile/CLAUDE.md`
- Cron → `apps/cron/CLAUDE.md`（task / repository 構造 / env 検証 / graceful shutdown / Docker / 本番起動想定）
- Worker → `apps/worker/CLAUDE.md`（Queue 抽象 / BullMQ → 他実装への切り替え方 / 新 Queue の追加手順 / 冪等性）
- スキーマ → `packages/schema/CLAUDE.md`（スキーマ命名規則）
- Terraform → `infra/terraform/CLAUDE.md`
- 共通パッケージ設計 → [`docs/spec/shared-packages/README.md`](docs/spec/shared-packages/README.md)（`@repo/db` / `@repo/logger` / `@repo/errors` / `@repo/redis` の仕様・設計・移行手順）

## Common Commands (root)

```bash
pnpm dev          # 全アプリを dev 起動
pnpm build        # 全アプリをビルド
pnpm lint         # ESLint
pnpm lint:fix     # ESLint 自動修正
pnpm test         # テスト
```

各アプリ固有のコマンドは対応サブディレクトリの `CLAUDE.md` を参照。

## Environment Requirements

- **Node.js**: >=18.0.0
- **pnpm**: >=9.0.0
- **Terraform**: インフラ作業時に必要
- **AWS CLI**: Terraform デプロイ時に必要

## Code Style and Linting

ESLint v9 flat config (`eslint.config.{js,mjs}`)。**全アプリ共通ルール**。

### ESLint Configuration Architecture
- **Web & Admin**: `eslint-config-next` を使用。`@typescript-eslint` プラグインを再定義してはいけない（"Cannot redefine plugin" エラー）
- **Mobile**: `eslint-config-expo/flat` を使用。同様に `@typescript-eslint` を再定義しない
- **API**: 全プラグインを自前で定義

### 共通ルール
- **No semicolons** (`semi: ["error", "never"]`)
- **Double quotes** (`quotes: ["error", "double"]`)
- **Object curly spacing**: `{ foo }` (not `{foo}`)
- **Strict equality**: `===` (not `==`)
- **Import ordering**: builtin → external → internal (`@repo`) → parent → sibling → index、グループ間に空行
- **Sort object keys** alphabetically (2+ keys)。例外:
  - `id` は常に先頭
  - `createdAt` / `updatedAt` / `deletedAt`（および snake_case）は常に末尾
  - 例: `{ id, color, name, sortOrder, createdAt, updatedAt }`
- **バレルエクスポート（index.ts）**: ファイル名のアルファベット順
- **React JSX props**: callbacks last, shorthand first, reserved first
- **TypeScript**: No `any` (warn), no empty functions, `async` for Promise-returning functions
- **Naming conventions**:
  - Variables: camelCase / UPPER_CASE / PascalCase
  - Functions: camelCase / PascalCase
  - Types: PascalCase
- **Prefer**: `const` over `let`/`var`、template literals、arrow callbacks
- **関数名は処理内容が明確にわかる名前にする**:
  - 悪い例: `parseCsvLine`, `toHalfWidth`, `parseAmount`
  - 良い例: `splitCsvLineWithQuotes`, `convertFullWidthToHalfWidth`, `convertCommaAmountToNumber`

### Function style
- **API (`apps/api`)**: `function` 宣言は使わず、`const` + アロー関数で統一（例: `export const foo = async () => {}`）
- **Web / Mobile / Admin**: コンポーネントは `function` に統一

### Class member style (全 apps / packages 共通)
- **constructor 以外のクラスメンバー（メソッド・プロパティ）は必ず `public` / `private` を明示する**（`@typescript-eslint/explicit-member-accessibility`）。修飾子を省略してデフォルトの `public` 扱いにしない。`protected` は継承を使う場合のみ。
- **`private` なメンバー（メソッド・プロパティ・constructor parameter property を含む）は `_` プレフィックスを必須にする**（`@typescript-eslint/naming-convention` の `memberLike` + `private` modifier + `leadingUnderscore: "require"`）。
- `constructor` は除外（修飾子を書かない）。
- 例:
  ```typescript
  /** ✓ OK */
  class PrismaUserRepository implements UserRepository {
    constructor(private readonly _prisma: PrismaClient) {}

    public async findById(id: number): Promise<User | null> {
      const row = await this._prisma.user.findUnique({ where: { id } })
      return row ? this._toDomain(row) : null
    }

    private _toDomain(row: PrismaUser): User {
      return { id: row.id, name: row.name }
    }
  }

  /** ✗ NG: public が無い */
  class Foo {
    doSomething() {}
  }

  /** ✗ NG: private に _ プレフィックスが無い */
  class Foo {
    private helper() {}
  }
  ```

### Comment style
- ブロックコメントは `/** */` 形式で統一（`//` は使わない）
- 1行でも複数行形式で書く:
  ```
  /**
   * コメント内容
   */
  ```

### When editing files
- 変更後は `pnpm lint:fix` を実行
- 新規 import はインポート順序ルールに従う

## Documentation Guidelines

仕様書・設計書は `docs/spec/` 配下、機能単位でディレクトリを切る。

- ファイル構成: `docs/spec/{feature}/README.md`（人間向け：背景・全体像・図） + `step{n}-{db|api|web|mobile|admin}-{feature}.md`（実装手順）
- 全て日本語で記述
- README.md には **目次（Table of Contents）必須**: GitHub Markdown アンカーリンク形式、`##` / `###` 見出しを全て含める
- step ファイル: 実装手順に番号を振らない、各ファイルは「対応内容」「動作確認」セクションを含める
- テンプレート: `docs/spec/template/README.md` および `docs/spec/template/step1-template.md`
- **図は Mermaid で記載する**: フロー図 / シーケンス図 / ER 図 / 状態遷移図はすべて ` ```mermaid ` コードフェンスを使う。ASCII アートは使わない（GitHub・VSCode 等でネイティブレンダリングされる）

**新機能を実装する前に必ず `design-feature` skill で設計書を作成する**。デザインのモックが必要なときは `design-mock` skill を使う（テーマヒアリング → admin 参照 → モック作成 → 承認後に仕様書追記）。

## Important Notes

- スキーマパッケージは依存アプリより先にビルドする必要がある
- スキーマ変更時は `cd packages/schema && pnpm build`
- Terraform state は S3 + S3 ネイティブロック（`use_lockfile = true`、Terraform 1.10+）構成（bootstrap で構成済み）
- **共通パッケージの設計方針**: `packages/db` / `logger` / `errors` / `config` / `redis` は server-side app 横断で利用される共通基盤。Prisma / Redis は **factory のみを export** し、各 app の `src/index.ts` で 1 回呼んで Repository に DI する。詳細は [`docs/spec/shared-packages/README.md`](docs/spec/shared-packages/README.md) を参照
