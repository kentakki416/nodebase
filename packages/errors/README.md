# @repo/errors

業務エラーを **値として** 返すための `Result<T>` 型と、`ApiError` 生成ヘルパを提供する共有パッケージ。**API / cron / worker 等の server-side app 全てで利用する**。

## 役割

- 業務エラーは `Result<T>` で **値として** 返す（throw しない）
- DB 障害などの想定外エラーは **throw** が原則で `Result` には乗せない
- service / repository 層のコードを app 横断で再利用できる共通言語を提供

## 公開 API

```ts
import {
  type Result,
  type ApiError,
  type ApiErrorType,
  ok,
  err,
  badRequestError,
  unauthorizedError,
  forbiddenError,
  notFoundError,
  conflictError,
} from "@repo/errors"
```

### 型

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError }

type ApiError = {
  statusCode: number
  type: ApiErrorType
  message: string
}

type ApiErrorType =
  | "BAD_REQUEST"     // 400
  | "UNAUTHORIZED"    // 401
  | "FORBIDDEN"       // 403
  | "NOT_FOUND"       // 404
  | "CONFLICT"        // 409
```

### ヘルパ

| 関数 | 用途 |
| --- | --- |
| `ok(value)` | 成功 `Result` を作る |
| `err(apiError)` | 失敗 `Result` を作る |
| `badRequestError(msg)` | 400 エラーを作る |
| `unauthorizedError(msg)` | 401 エラーを作る |
| `forbiddenError(msg)` | 403 エラーを作る |
| `notFoundError(msg)` | 404 エラーを作る |
| `conflictError(msg)` | 409 エラーを作る |

## 使い方

### service 層

```ts
import { type Result, ok, err, notFoundError } from "@repo/errors"
import type { Memo } from "@repo/db"

export const getMemoById = async (
  id: number,
  { memoRepository }: { memoRepository: MemoRepository },
): Promise<Result<Memo>> => {
  const memo = await memoRepository.findById(id)
  if (!memo) return err(notFoundError(`memo ${id} not found`))
  return ok(memo)
}
```

### controller 層

```ts
const result = await service.memo.getMemoById(id, { memoRepository })
if (!result.ok) {
  return res.status(result.error.statusCode).json({ error: result.error })
}
return res.json(result.value)
```

## 設計方針

- **業務エラー = `Result`、想定外エラー = throw** の使い分けを徹底する
- `Result<T>` は judge する側に **必ず `.ok` の分岐を強制** する（discriminated union）
- 依存ゼロ（他の `@repo/*` パッケージに依存しない）
- Node / ブラウザ両対応の純粋な型 + 関数のみ

## ディレクトリ構成

```
packages/errors/
└── src/
    ├── result.ts    # Result<T> + ApiError + ヘルパ
    └── index.ts     # re-export
```
