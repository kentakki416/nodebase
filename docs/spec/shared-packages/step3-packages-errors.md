# step3-packages-errors.md

`@repo/errors` パッケージを新設し、`apps/api/src/types/result.ts` の `Result<T>` / `ApiError` / ヘルパ関数群を移設する。完了時点で `apps/api` は `@repo/errors` から型・ヘルパを import 可能になる（既存パスも wrapper で互換維持）。

## 対応内容

### 1. ディレクトリ作成

```
packages/errors/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── .gitignore
└── src/
    ├── result.ts
    └── index.ts
```

### 2. `packages/errors/package.json`

```json
{
  "name": "@repo/errors",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "dev": "tsc --watch",
    "lint": "eslint 'src/**/*.ts'",
    "lint:fix": "eslint 'src/**/*.ts' --fix"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@typescript-eslint/eslint-plugin": "^8.46.4",
    "@typescript-eslint/parser": "^8.46.4",
    "eslint": "^9.39.1",
    "typescript": "^5.9.3"
  }
}
```

runtime 依存はゼロ（純粋な型 + 純関数のみ）。

### 3. `packages/errors/src/result.ts`

`apps/api/src/types/result.ts` を **そのまま** 移設。加えて、既存に無い `forbiddenError` ヘルパを追加（`FORBIDDEN` 型は既に定義済みだがヘルパが無いため）。

```typescript
/**
 * サービス層が呼び出し元に返す「業務エラー」の型
 * 例外 (throw) ではなく、戻り値として返すことで呼び出し側が型安全に扱える
 */
export type ApiError = {
  /**
   * HTTP ステータスコード（4xx 系）
   */
  statusCode: number
  /**
   * エラーの種類を識別するタグ（ログ・分岐用）
   */
  type: ApiErrorType
  /**
   * ユーザー向けのエラーメッセージ
   */
  message: string
}

/**
 * 業務エラーのタグ一覧
 */
export type ApiErrorType =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAUTHORIZED"

/**
 * サービス層の戻り値の型
 * 成功時は ok: true で value を返す
 * 業務エラー時は ok: false で error を返す
 * DB 障害などの予期しないエラーは例外として throw する
 */
export type Result<T> =
  | { ok: true; value: T }
  | { error: ApiError; ok: false }

/**
 * 成功の Result を生成する
 */
export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

/**
 * 業務エラーの Result を生成する
 */
export const err = <T = never>(error: ApiError): Result<T> => ({ error, ok: false })

/**
 * 400 Bad Request のエラーを生成する
 */
export const badRequestError = (message: string): ApiError => ({
  message,
  statusCode: 400,
  type: "BAD_REQUEST",
})

/**
 * 401 Unauthorized のエラーを生成する
 */
export const unauthorizedError = (message: string): ApiError => ({
  message,
  statusCode: 401,
  type: "UNAUTHORIZED",
})

/**
 * 403 Forbidden のエラーを生成する
 */
export const forbiddenError = (message: string): ApiError => ({
  message,
  statusCode: 403,
  type: "FORBIDDEN",
})

/**
 * 404 Not Found のエラーを生成する
 */
export const notFoundError = (message: string): ApiError => ({
  message,
  statusCode: 404,
  type: "NOT_FOUND",
})

/**
 * 409 Conflict のエラーを生成する
 */
export const conflictError = (message: string): ApiError => ({
  message,
  statusCode: 409,
  type: "CONFLICT",
})
```

### 4. `packages/errors/src/index.ts`

```typescript
export {
  badRequestError,
  conflictError,
  err,
  forbiddenError,
  notFoundError,
  ok,
  unauthorizedError,
} from "./result"
export type { ApiError, ApiErrorType, Result } from "./result"
```

### 5. `packages/errors/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "composite": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 6. `packages/errors/.gitignore` / `eslint.config.js`

```
# .gitignore
dist/
node_modules/
```

eslint config は `packages/schema/eslint.config.js` をコピー。

### 7. `apps/api` 側の互換 wrapper

`apps/api/src/types/result.ts` を 1 行に置き換え：

```typescript
/**
 * @deprecated step5 で削除予定。新規コードは "@repo/errors" から直接 import すること
 */
export * from "@repo/errors"
```

### 8. `apps/api/package.json` の修正

```diff
   "dependencies": {
     "@repo/db": "workspace:^",
     "@repo/api-schema": "workspace:^",
+    "@repo/errors": "workspace:^",
     "@repo/logger": "workspace:^",
```

`@repo/errors` は runtime 依存ゼロなので、追加するだけで OK。

## 動作確認

### 単体確認

```bash
cd packages/errors
pnpm install
pnpm build

# 型定義が出力されている
test -f packages/errors/dist/index.d.ts && echo OK

# ヘルパ関数が呼び出せる
node -e "
const { ok, err, notFoundError, badRequestError, conflictError, forbiddenError, unauthorizedError } = require('./dist');
console.log(ok(42));
console.log(err(notFoundError('not found')));
console.log(err(badRequestError('bad request')));
console.log(err(conflictError('conflict')));
console.log(err(forbiddenError('forbidden')));
console.log(err(unauthorizedError('unauthorized')));
"
```

期待出力：

```
{ ok: true, value: 42 }
{ error: { message: 'not found', statusCode: 404, type: 'NOT_FOUND' }, ok: false }
{ error: { message: 'bad request', statusCode: 400, type: 'BAD_REQUEST' }, ok: false }
{ error: { message: 'conflict', statusCode: 409, type: 'CONFLICT' }, ok: false }
{ error: { message: 'forbidden', statusCode: 403, type: 'FORBIDDEN' }, ok: false }
{ error: { message: 'unauthorized', statusCode: 401, type: 'UNAUTHORIZED' }, ok: false }
```

### apps/api 側の確認

```bash
cd apps/api
pnpm build

# 既存 wrapper 経由でも動く
node -e "const { ok, notFoundError } = require('./dist/types/result'); console.log(ok('via wrapper'))"

# 直接 import でも動く
node -e "const { ok } = require('@repo/errors'); console.log(ok('via direct'))"
```

### テスト

```bash
cd apps/api
pnpm test:ci
```

**ゴール**: `apps/api` の既存 Service / Controller テストが緑のまま、`apps/api/src/types/result.ts` が wrapper 1 行になっている状態。`forbiddenError` ヘルパが追加で使えるようになる。
