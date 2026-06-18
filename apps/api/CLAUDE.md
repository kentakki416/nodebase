# apps/api

Express.js + TypeScript の API サーバー（port 8080）。リクエスト/レスポンスは全て `@repo/api-schema` の Zod スキーマで検証する。

## Commands

```bash
pnpm dev          # ts-node-dev でホットリロード起動
pnpm build        # dist/ にコンパイル
pnpm start        # dist/ から起動
pnpm test         # ローカル用（dotenvx で .env.local を復号化して vitest run）
pnpm test:ci      # CI用（dotenvx不要。環境変数は外部から渡す前提。generate + migrate + vitest run を一括）
pnpm test:watch   # vitest の watch モード（変更ファイルだけ再実行）
pnpm test:coverage # カバレッジ計測（V8 ベース、coverage/ に出力）
```

## API レイヤードアーキテクチャ（必ず既存ファイルを参考に実装）

新機能を追加する際は、必ず既存実装（例: memo, health）のコードを読んでからパターンを合わせること。

- **Repository**（`src/repository/prisma/`）: Interface + Class パターン
  - `interface {Feature}Repository` でインターフェース定義
  - `class Prisma{Feature}Repository implements {Feature}Repository` で実装
  - constructor で `PrismaClient` を受け取る
  - `private _toDomain()` メソッドで Prisma の型 → ドメイン型に変換
  - Input 型（`Create{Feature}Input`, `Update{Feature}Input`）はリポジトリファイル内に定義
- **Service**（`src/service/`）: エクスポート関数パターン
  - クラスではなく `export const` のアロー関数で定義
  - **Repository は単一でも複数でも必ず `repo` という名前のオブジェクト引数にまとめる**（引数の数を増やさず、将来 Repository が追加されてもシグネチャを変えなくて済むため）
    ```typescript
    /** ✗ 単一 Repository を直に受け取る（禁止） */
    export const getUserById = async (userId: number, userRepository: UserRepository): Promise<Result<User>> => { ... }

    /** ✓ 単一でも repo: { ... } で統一 */
    export const getUserById = async (
      userId: number,
      repo: { userRepository: UserRepository }
    ): Promise<Result<User>> => {
      const user = await repo.userRepository.findById(userId)
      ...
    }

    /** ✓ 複数 Repository も同じ形 */
    export const authenticateWithGoogle = async (
      code: string,
      repo: {
        authAccountRepository: AuthAccountRepository
        userRegistrationRepository: UserRegistrationRepository
      },
      ...
    ): Promise<Result<...>> => { ... }
    ```
  - `service/index.ts` で `export * as {feature} from "./{feature}-service"` としてバレルエクスポート
  - 呼び出し側は `service.{feature}.{method}(data, { fooRepository })` の形式（プロパティ名は型定義と一致させる）
  - `logger.debug()` で処理の開始・完了をログ出力
  - **戻り値は必ず `Promise<Result<T>>`**（業務エラーは `err(...)`、想定外エラーは throw）
- **Controller**（`src/controller/{feature}/`）: Class + `execute(req, res)` パターン。API（エンドポイント）と1対1でファイルを作成
  - Admin とアプリケーションでリクエスト・レスポンスが異なるため、同じドメインでもアプリごとにコントローラーを分ける（例: `controller/category/list.ts` と `controller/admin/category-list.ts`）
  - `class {Feature}{Action}Controller` で定義（例: `CategoryListController`）
  - constructor で Repository を受け取る
  - `async execute(req: Request, res: Response)` メソッドで処理
  - `@repo/api-schema` のスキーマで `req.params` / `req.body` / `req.query` をバリデーション、レスポンスを parse
  - **try-catch は書かない**。Service が `throw` した想定外エラーは想定外例外ハンドラが 500 で返却
  - **Service の `Result` は `sendError` ヘルパ経由で返却する（必須）**:
    ```typescript
    import { sendError } from "../../lib/send-error"

    if (!result.ok) {
      return sendError(req, res, result.error)
    }
    ```
    `sendError` は `logger.warn("API business error", { method, path, statusCode, type })` を出してから `ErrorResponse` を JSON 返却する。ログ書き忘れを構造的に防ぐため inline で `res.status().json()` を直接書かない
- **Router**（`src/routes/`）: Optional controllers オブジェクトパターン
  - `type {Feature}RouterControllers = { list?: ..., create?: ..., ... }` で定義
  - `export const {feature}Router = (controllers: {Feature}RouterControllers): Router => { ... }`
  - 各コントローラーが存在する場合のみルートを登録
- **Domain 型**（`src/types/domain/`）: 各機能ごとにファイルを作成し、`index.ts` でバレルエクスポート
  - ビジネス上の区分・列挙型もここに定義する（例: `RegistrationPeriod`）
  - Repository / Service は `types/domain` から型をインポートする（`@repo/api-schema` に依存しない）
  - `@repo/api-schema` の Zod スキーマは同じ値で独立定義し、API バリデーション用として使う
- **DI（依存性注入）**: `index.ts` で Repository → Controller → Router の順にインスタンス化して組み立て

## エラーハンドリング（Result 型）

Service 層は **業務エラー（4xx 系）は `Result<T>` で返却、想定外の例外（DB 障害等）は throw** する。Controller は Result を `sendError` ヘルパ経由で返し、想定外エラーは想定外例外ハンドラが 500 で処理する。

### 責務分担

| 経路 | 例 | ログ | ステータス |
|---|---|---|---|
| Service の `Result.err` | NotFound / Conflict / Unauthorized 等の業務エラー | `sendError` が `logger.warn` | `result.error.statusCode`（4xx）|
| ルート内の throw（DB 障害等の想定外） | TCP 切断 / Prisma 例外 | `unhandledExceptionHandler` が `logger.error` + スタック | 500 |
| リクエストスキーマ違反 | `RequestSchemaMismatchError` | `unhandledExceptionHandler` が `logger.warn` | 400 |
| レスポンススキーマ違反 | `ResponseSchemaMismatchError` | `unhandledExceptionHandler` が `logger.error` | 500 |
| アクセスログ（受信 / 完了 / 異常切断） | 全リクエスト | `requestLogger` が `info` / `warn` | - |

### 例外的に try/catch を許容するケース

「Controller / Service で try-catch は書かない」は **想定外エラーを catch するな**（throw 伝播を壊すな）という意味であり、以下 2 ケースは局所 try/catch を許容する:

| ケース | 例 | 扱い |
|---|---|---|
| **副次処理の意図的握りつぶし** | 通知送信の失敗等、メイン処理を成功扱いにしたい副次処理 | `try { ... } catch (err) { logger.warn(...) }` の後そのまま処理を続行。**catch 内で再 throw しない** |
| **エラーを値に変換する必要** | `health-service` のサービスチェック（個別失敗を `status: "error"` に集約して両方の status を必ず返す） | `try { ... } catch (err) { return { status: "error", ... } }` |

これ以外の用途（fallback、リトライ、業務エラーの隠蔽）では `Result` で表現するか、そのまま throw して `unhandledExceptionHandler` に委譲する。

### Result 型の定義（`src/types/result.ts`）

```typescript
export type ApiError = {
  statusCode: number
  type: "BAD_REQUEST" | "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" | "UNAUTHORIZED"
  message: string
}

export type Result<T> =
  | { ok: true; value: T }
  | { error: ApiError; ok: false }
```

### ヘルパー関数

```typescript
import { ok, err, notFoundError, conflictError, badRequestError } from "../types/result"

return ok(user)                                              // 成功
return err(notFoundError("User not found"))                  // 404
return err(conflictError("Same file already uploaded"))      // 409
return err(badRequestError("Invalid category_id"))           // 400
```

### Service 実装ルール

- **業務エラー**: `return err(conflictError(...))` のように Result で返却
- **想定外エラー**: DB 呼び出し等での `throw` はそのまま伝播（catch しない）
- **シグネチャ**: `Promise<Result<T>>` を返す（`Promise<T>` ではなく）

```typescript
export const createFoo = async (...): Promise<Result<Foo>> => {
  const existing = await repo.findById(...)
  if (existing) {
    return err(conflictError("Already exists"))  // 業務エラー
  }
  const foo = await repo.create(...)             // DB 障害時は throw する（catch しない）
  return ok(foo)
}
```

### Controller 実装ルール

- **Service から別 Service を呼ぶときも Result の ok 判定を行い、そのまま re-return か再解釈する**
- **`sendError` 経由で返却**（透過返却が基本。Service の statusCode がそのまま API の statusCode）
- **再解釈が必要な場合のみ Controller で明示的に変換**（例: pre-condition check の 404 を 400 に変換。新しい `ApiError` を作って `sendError` に渡す）

```typescript
import { parseRequest, parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"

async execute(req: Request, res: Response) {
  const { id } = parseRequest(deleteMemoPathParamSchema, req.params)

  const result = await service.memo.deleteMemo(id, { memoRepository: this._memoRepository })

  if (!result.ok) {
    return sendError(req, res, result.error)
  }

  const response = parseResponse(deleteMemoResponseSchema, { message: "OK" })
  return res.status(200).json(response)
}
```

### sendError ヘルパ（`src/lib/send-error.ts`）

Controller で `Result.err` を HTTP レスポンスとして返却する共通関数。**Controller の `if (!result.ok)` ブロックは必ずこのヘルパ経由で返却すること**（書き忘れを構造的に防ぐ目的）。

- 内部で `logger.warn("API business error", { method, path, statusCode, type })` を出す
- `ErrorResponse` スキーマで JSON を組み立てて返す
- throw しないため、想定外例外ハンドラは通らない（業務エラーと想定外例外を経路レベルで分離）

### 想定外例外ハンドラ（`src/middleware/unhandled-exception-handler.ts`）

すべてのルート登録後に `app.use(unhandledExceptionHandler)` で登録される。**業務 4xx エラー（`Result.err`）は `sendError` 経由で返却されるため、このハンドラは通らない**。

- **`RequestSchemaMismatchError`** → 400 "Invalid request"（クライアント入力不正、`logger.warn`）
- **`ResponseSchemaMismatchError`** → 500 "Internal Server Error"（サーバ起因の契約違反、`logger.error`）
- **その他の throw** → 500 "Internal Server Error"（DB 障害等の想定外エラー、`logger.error` + スタック）

Controller で try-catch を書く必要はない。

## Admin API 設計方針

- Admin API はすべて `/api/admin/` 配下に配置し、ユーザー向け API と分離する
- Controller / Service は共通のものを使い、Router（`admin-router.ts`）で `/api/admin/` にマッピング
- スキーマは `api-schema/admin/` に集約。既存と同一なら re-export、Admin 固有のレスポンスが必要になった時点で新規定義
- 認証: 現時点は `PUBLIC_PATHS` で認証なし（将来 Admin 専用認証を追加予定）
- ダミーデータ: `ADMIN_USE_DUMMY=true`（API の `.env.local`）で DB 不要のダミーモード

## テスト戦略とテストの耐久性（必須）

### レイヤー別のテスト種別

- **テストランナー**: Vitest（Jest からの全面移行済み）。`describe` / `it` / `expect` / `beforeEach` / `vi` などは `vitest.config.ts` の `globals: true` によりグローバル展開されており、import は不要
- **Service層 → ユニットテスト**（`apps/api/test/service/`）: DB 不要、`vi.fn()` で Repository をモック、高速・並列実行可
- **Controller層 → インテグレーションテスト**（`apps/api/test/controller/`）: 自前インフラ（Postgres・Redis）は本物を使い、`supertest` で HTTP レイヤーから検証

### テストケースの分類ルール（必須）

**テストケースは `describe` を入れ子にして「正常系」「異常系」で必ず分類する**。トップレベルの `describe` はテスト対象（関数名 / エンドポイント）にし、その直下に `describe("正常系", ...)` と `describe("異常系", ...)` を置いて `it` をぶら下げる。これにより `pnpm test:watch` の出力や CI ログでテストの意図が一目で読み取れ、抜け漏れ（異常系が無い等）にも気付きやすくなる。

#### 分類の定義

| 分類 | 対象 |
|---|---|
| **正常系** | 入力が正しく、期待通りに処理が成功するケース。Service なら `ok: true`、Controller なら 2xx を返すケース全般 |
| **異常系** | 業務エラー（4xx 系）、バリデーションエラー、想定外の例外（DB 障害等）、境界値で除外されるケースなど、正常系以外すべて |

#### 推奨パターン

**Service ユニットテスト**:

```typescript
describe("getMemoById", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("正常系", () => {
    it("メモが存在する場合、ok: true とメモを返す", async () => {
      /** ... */
    })
  })

  describe("異常系", () => {
    it("メモが存在しない場合、ok: false と NOT_FOUND エラーを返す", async () => {
      /** ... */
    })

    it("DB 障害時にエラーをスローする", async () => {
      /** ... */
    })
  })
})
```

**Controller インテグレーションテスト**:

```typescript
describe("POST /api/auth/google", () => {
  describe("正常系", () => {
    it("新規ユーザーの場合、200 を返し DB にユーザーが作成される", async () => {
      /** ... */
    })

    it("既存ユーザーの場合、200 と is_new_user=false を返す", async () => {
      /** ... */
    })
  })

  describe("異常系", () => {
    it("code が無い場合、400 を返す", async () => {
      /** ... */
    })

    it("Google 認証エラー時、500 を返す", async () => {
      /** ... */
    })
  })
})
```

#### 補足

- `describe("正常系", ...)` / `describe("異常系", ...)` の **2 ブロックのみ** を基本とする。さらに細分化したい場合は内側で `describe` を追加して良い（例: `describe("異常系", () => { describe("バリデーションエラー", ...) })`）
- 既存テストを編集する際もこの構造に揃える。新規テストを追加するときに片方のブロックが無ければ、その場で追加する

### Controller integration テストでモックして良いもの／いけないもの

| 種類 | 例 | 扱い | 理由 |
|---|---|---|---|
| 自前インフラ | Postgres / Redis | **本物**（テスト用 DB に接続） | キー名・TTL・型変換・SQL の誤りなど、mock では検出できない不具合を捕捉する |
| 外部 SaaS / ネットワーク | Google OAuth Client / S3 / 課金 API | **モック** | 外部依存・遅い・課金される・異常系の再現が難しい |
| ピュアロジック | 計算・変換関数 | （モック不要） | Service ユニットテストで網羅 |

**自前 Redis を `mockRefreshTokenRepository` のように `vi.fn()` で差し替えるのは Controller integration テストでは禁止**。`new IoRedisRefreshTokenRepository(testRedis)` で実 Redis を注入し、`beforeEach` で `cleanupTestRedis()` を呼んで分離する。

```typescript
import { IoRedisRefreshTokenRepository } from "../../../src/repository/redis"
import {
  cleanupTestData,
  cleanupTestRedis,
  disconnectTestDb,
  disconnectTestRedis,
  testPrisma,
  testRedis,
} from "../setup"

const refreshTokenRepository = new IoRedisRefreshTokenRepository(testRedis)
/** 外部 SaaS は mock のまま */
const mockGoogleOAuthClient: IGoogleOAuthClient = { getUserInfo: vi.fn() }

beforeEach(async () => {
  await cleanupTestData()
  await cleanupTestRedis()
})

afterAll(async () => {
  await cleanupTestData()
  await cleanupTestRedis()
  await disconnectTestDb()
  await disconnectTestRedis()
})
```

### アサーションは「最終状態」まで含める

「メソッドが呼ばれた」だけ検証する mock 駆動の assertion は Controller integration テストでは不十分。**Postgres / Redis の最終状態を直接確認する**。

```typescript
/** ❌ 悪い例: 呼び出しの検証だけ（自前インフラを mock しているとこれしかできない） */
expect(mockRefreshTokenRepository.save).toHaveBeenCalled()

/** ✅ 良い例: Redis の最終状態を確認 */
const payload = verifyRefreshToken(res.body.refresh_token)
expect(await refreshTokenRepository.findUserId(payload!.jti)).toBe(userId)

/** ✅ 良い例: Postgres の最終状態を確認 */
const createdUser = await testPrisma.user.findUnique({ where: { email: "new@example.com" } })
expect(createdUser).not.toBeNull()
```

「呼び出し検証」は Service ユニットテストの責務。Controller integration テストは「実際に永続層が意図通り変化したか」を検証する。

### オブジェクト一括 assertion を使う（フィールドごとの個別 assertion を避ける）

レスポンスや DB 行を1フィールドずつ `expect(...).toBe(...)` で比較すると、検証漏れ・ノイズ・差分の読みにくさが生じる。**オブジェクト全体を `toEqual` または `toMatchObject` で一括検証する**。

```typescript
/** ❌ 悪い例: フィールドごとの個別 assertion */
expect(res.status).toBe(200)
expect(res.body.access_token).toBeDefined()
expect(res.body.refresh_token).toBeDefined()
expect(res.body.is_new_user).toBe(true)
expect(res.body.user.email).toBe("new@example.com")

/** ✅ 良い例: API レスポンスは toEqual で全フィールド完全一致 */
expect(res.status).toBe(200)
expect(res.body).toEqual({
  access_token: expect.any(String),
  is_new_user: true,
  refresh_token: expect.any(String),
  user: {
    avatar_url: "https://example.com/new-avatar.jpg",
    created_at: expect.any(String),
    email: "new@example.com",
    id: expect.any(Number),
    name: "New User",
  },
})

/** ✅ 良い例: DB 行は toMatchObject で内部詳細（id/timestamp）を省略 */
const createdUser = await testPrisma.user.findUnique({ where: { email: "new@example.com" } })
expect(createdUser).toMatchObject({
  avatarUrl: "https://example.com/new-avatar.jpg",
  email: "new@example.com",
  name: "New User",
})

/** ✅ 良い例: エラーレスポンスも完全契約で検証（文言は any） */
expect(res.status).toBe(400)
expect(res.body).toEqual({ error: expect.any(String), status_code: 400 })

/** ✅ 良い例: Redis のような単一値は toBe のままで簡潔 */
expect(await refreshTokenRepository.findUserId(jti)).toBe(userId)
```

#### 推奨指針

| 対象 | 推奨マッチャー | 理由 |
|---|---|---|
| API レスポンス（外部契約） | **`toEqual`** + `expect.any(...)` | スキーマ変更の検出が重要（フィールド増減で落ちる方が望ましい） |
| DB 行（内部状態） | **`toMatchObject`** | id / timestamp は内部詳細なので省略 OK |
| Redis / 単一値 | `toBe` のまま | 1値なので一括にする意味がない |

`toEqual` は完全一致のためフィールド追加・削除で必ずテストが落ちる。これにより**契約変更の見落としを防げる**（API レスポンスでは特に重要）。一方 `toMatchObject` は subset 一致なので、id や timestamp などテストごとに揺れる値を含む DB 行に向く。

### テストの耐久性（重要）

**エラーメッセージなどの文字列は assertion しない**。テストが脆くなり、文言変更・i18n 対応・ログ改善のたびに無関係なテストが落ちるため。

#### 禁止パターン

```typescript
/** メッセージの文言に依存した assertion は禁止 */
await expect(uploadCsv(...)).rejects.toThrow("このCSVファイルはすでにアップロード済みです")
expect(res.body.error).toBe("Invalid memo ID")
expect(result.error.message).toContain("すでに")
```

#### 推奨パターン

**Service のユニットテスト**: Result 型の構造（`ok` / `statusCode` / `type`）のみを検証

```typescript
/** 業務エラー */
const result = await uploadCsv(...)
expect(result.ok).toBe(false)
if (!result.ok) {
  expect(result.error.statusCode).toBe(409)
  expect(result.error.type).toBe("CONFLICT")
}

/** 想定外の例外（DB 障害等） */
await expect(uploadCsv(...)).rejects.toThrow()  // メッセージは引数に渡さない
```

**Controller のインテグレーションテスト**: HTTP ステータスコードとレスポンスボディの「存在」のみを検証

```typescript
expect(res.status).toBe(400)
expect(res.body.error).toBeDefined()  // 文言は照合しない
```

### Controller テストのセットアップ

バリデーションエラー（`ZodError`）を 400 として返すには、テスト用 app に `attachUnhandledExceptionHandler` を登録する必要がある:

```typescript
import { attachUnhandledExceptionHandler, createTestApp } from "../helper"

const app = createTestApp()
app.use("/api/memo", memoRouter({ ... }))
attachUnhandledExceptionHandler(app)  // ← ルート登録後に必ず呼ぶ
```

### モックの方針

- **デフォルトは `vi.fn()` を使用する**。interface に基づいたオブジェクトを `vi.fn()` で作成し、引数として渡す
- **`vi.mock()` は非推奨**。import パスに結合するためリファクタリング耐性が低い
- **自作 Fake（例: `InMemoryXxxRepository`）は、テスト内で状態の読み書きが複数回絡む場合のみ検討する**
- **モック関数の引数型は `vi.fn<(_0: ArgType) => ReturnType>()` の形で明示する**（型推論を効かせて assertion の補完と誤った引数渡しを防ぐ）

### この方針の理由

1. **リファクタリング耐性**: 文言改善・ログ改修・i18n 対応でテストが落ちない
2. **レビュー負荷軽減**: 文言変更のたびにテストを更新する必要がない
3. **網羅性と独立性**: 「何が起きたか」は `statusCode` / `type` で構造的に表現し、文字列で表現しない
4. **AI/自動化フレンドリー**: 文言に例外を作らないため、AI による自動リファクタリングで誤検知が起きにくい

### 境界値テスト（必須）

日付フィルタや条件分岐を含む API では、**境界値のテストケースを必ず追加する**。正常系だけでなく、境界の直前・直後のデータで意図通りに含まれる/除外されることを検証する。

#### 日付フィルタの場合

月フィルタでは **前月末日・当月初日・当月末日・翌月初日** の4点をテストデータに含め、当月のデータだけが返ることを検証する:

```typescript
/** 3月フィルタの境界値テスト */
await testPrisma.transaction.createMany({
  data: [
    { transactionDate: new Date("2026-02-28"), description: "前月末" },  // 含まれない
    { transactionDate: new Date("2026-03-01"), description: "当月初" },  // 含まれる
    { transactionDate: new Date("2026-03-31"), description: "当月末" },  // 含まれる
    { transactionDate: new Date("2026-04-01"), description: "翌月初" },  // 含まれない
  ],
})

const res = await request(app).get("/api/transactions").query({ month: 3, year: 2026 })
expect(res.body.transactions).toHaveLength(2)
```

#### 条件分岐の場合

if文 / switch文でデータの振り分けがある場合、**各分岐の境界値**をテストデータに含める（例: 金額が0以下でスキップする処理なら `amount: 0` と `amount: 1` の両方をテスト）。

## 環境変数の管理（dotenvx）

`.env.local` ファイルの環境変数は [dotenvx](https://dotenvx.com/) で暗号化されている。**手動で `.env.local` を編集してはならない**。必ず以下のコマンドを使うこと。

```bash
# 環境変数の追加・更新（apps/api ディレクトリで実行）
npx dotenvx set KEY_NAME "value" -f .env.local

# 環境変数の値を確認（復号化して表示）
npx dotenvx get KEY_NAME -f .env.local

# 全環境変数を復号化して表示
npx dotenvx get -f .env.local
```

- 暗号化の鍵は `.env.keys` ファイルに格納されている（`.gitignore` 対象）
- `package.json` のスクリプトは `dotenvx run -f .env.local --` で環境変数を注入して実行する

## 新エンドポイント追加の手順

1. `packages/schema/src/api-schema/{domain}.ts` にスキーマ定義（命名規則は `packages/schema/CLAUDE.md` 参照）
2. `packages/schema/src/api-schema/index.ts` から export
3. `cd packages/schema && pnpm build`
4. Domain 型 → Repository → Service → Controller → Router の順で実装
5. Service ユニットテスト + Controller インテグレーションテストを作成
6. `index.ts` で DI を組み立て
