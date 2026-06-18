# step4-api-credential: Credential CRUD（暗号化）

Credential（API key 等）の保存・取得・削除 API。**保存時に AES-256-GCM で暗号化、取得時は平文を返さない**。

## 対応内容

### 1. 暗号化ライブラリ

`apps/api/src/lib/encryption.ts` を新規作成。`packages/db` に置かない理由は、暗号化は API 固有の責務だから（DB は単に文字列を保持するだけ）。Worker 側でも同じ実装をコピーするのではなく、共通化したくなったら `packages/crypto` を切る（**今はしない**）。

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

const getKey = (): Buffer => {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) throw new Error("ENCRYPTION_KEY is not set")
  const key = Buffer.from(hex, "hex")
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)")
  return key
}

/**
 * 平文 -> "iv:authTag:ciphertext" (base64url)
 */
export const encrypt = (plain: string): string => {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(":")
}

/**
 * 暗号文 -> 平文。改ざんがあれば throw
 */
export const decrypt = (encoded: string): string => {
  const [ivB64, tagB64, ctB64] = encoded.split(":")
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Invalid ciphertext format")
  const iv = Buffer.from(ivB64, "base64url")
  const tag = Buffer.from(tagB64, "base64url")
  const ct = Buffer.from(ctB64, "base64url")
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
}

/**
 * UI 表示用にマスクする（保存値の頭 4 文字 + "****"）
 * encrypted 値そのものではなく、復号後の平文に対して掛ける
 */
export const maskSecret = (plain: string): string => {
  if (plain.length <= 4) return "****"
  return `${plain.slice(0, 4)}****`
}
```

### 2. env 追加

`apps/api/src/env.ts` の Zod schema に追加:

```typescript
ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, "must be 32-byte hex"),
```

`.env.local`（暗号化済み）にも `ENCRYPTION_KEY` を追加:

```bash
# 32 byte 鍵を生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 出力された 64 char hex を dotenvx で投入
npx dotenvx set ENCRYPTION_KEY "<hex>" -f apps/api/.env.local
```

apps/worker 側でも同じ `ENCRYPTION_KEY` を参照する。

### 3. Schema

`packages/schema/src/api-schema/credential.ts`:

```typescript
import { z } from "zod"

export const credentialTypeSchema = z.enum(["OPENAI"])

export const credentialSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string(),
  maskedValue: z.string(),
  name: z.string(),
  type: credentialTypeSchema,
  updatedAt: z.string().datetime(),
})

export const listCredentialsResponseSchema = z.object({
  credentials: z.array(credentialSchema),
})

export const createCredentialRequestSchema = z.object({
  name: z.string().min(1).max(255),
  type: credentialTypeSchema,
  value: z.string().min(1),
})

export const createCredentialResponseSchema = credentialSchema
```

### 4. Domain

```typescript
export type Credential = {
  id: string
  userId: number
  name: string
  type: string
  encryptedValue: string
  createdAt: Date
  updatedAt: Date
}
```

### 5. Repository

`apps/api/src/repository/prisma/credential-repository.ts`:

```typescript
export interface CredentialRepository {
  findManyByUser(userId: number): Promise<Credential[]>
  findByIdForUser(id: string, userId: number): Promise<Credential | null>
  create(input: { userId: number, name: string, type: string, encryptedValue: string }): Promise<Credential>
  delete(id: string, userId: number): Promise<boolean>
}

/** PrismaCredentialRepository: 一覧 / 詳細 / 作成 / 削除。
 *  暗号化は service / lib 層の責務、Repository は encryptedValue をそのまま保存
 */
```

### 6. Service

```typescript
import { encrypt, decrypt, maskSecret } from "../lib/encryption"

export const listCredentials = async (
  userId: number,
  repo: { credentialRepository: CredentialRepository }
): Promise<Result<Array<{ id: string, name: string, type: string, maskedValue: string, createdAt: Date, updatedAt: Date }>>> => {
  const credentials = await repo.credentialRepository.findManyByUser(userId)
  return ok(credentials.map((c) => ({
    createdAt: c.createdAt,
    id: c.id,
    maskedValue: maskSecret(decrypt(c.encryptedValue)),
    name: c.name,
    type: c.type,
    updatedAt: c.updatedAt,
  })))
}

export const createCredential = async (
  userId: number, input: { name: string, type: string, value: string },
  repo: { credentialRepository: CredentialRepository }
): Promise<Result<{ ... }>> => {
  const encryptedValue = encrypt(input.value)
  const credential = await repo.credentialRepository.create({
    encryptedValue, name: input.name, type: input.type, userId,
  })
  return ok({
    createdAt: credential.createdAt,
    id: credential.id,
    maskedValue: maskSecret(input.value),
    name: credential.name,
    type: credential.type,
    updatedAt: credential.updatedAt,
  })
}

export const deleteCredential = async (
  id: string, userId: number,
  repo: { credentialRepository: CredentialRepository }
): Promise<Result<{ message: string }>> => {
  const deleted = await repo.credentialRepository.delete(id, userId)
  if (!deleted) return err(notFoundError("Credential not found"))
  return ok({ message: "OK" })
}
```

### 7. Controller / Router

- `GET /api/credentials`
- `POST /api/credentials`
- `DELETE /api/credentials/:id`

詳細取得（`GET /api/credentials/:id`）は **MVP では作らない**（一覧で十分。値も返さない）。

## 動作確認

### Service ユニットテスト

```typescript
describe("createCredential", () => {
  describe("正常系", () => {
    it("encryptedValue が DB に保存され、レスポンスはマスクされる", async () => {
      process.env.ENCRYPTION_KEY = "00".repeat(32)
      const mockRepo = { create: vi.fn().mockResolvedValue({ ... }) }
      const result = await createCredential(1, { name: "OpenAI", type: "OPENAI", value: "sk-abc123" }, { credentialRepository: mockRepo as any })
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        encryptedValue: expect.stringMatching(/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/),
      }))
      if (result.ok) expect(result.value.maskedValue).toBe("sk-a****")
    })
  })
})
```

### 暗号化単体テスト

`apps/api/test/lib/encryption.test.ts`:

```typescript
describe("encryption", () => {
  beforeEach(() => { process.env.ENCRYPTION_KEY = "00".repeat(32) })
  describe("正常系", () => {
    it("encrypt -> decrypt で元の値に戻る", () => {
      const plain = "sk-test-1234567890"
      expect(decrypt(encrypt(plain))).toBe(plain)
    })
    it("同じ平文でも毎回異なる暗号文になる（iv がランダム）", () => {
      expect(encrypt("x")).not.toBe(encrypt("x"))
    })
  })
  describe("異常系", () => {
    it("不正な暗号文で throw", () => {
      expect(() => decrypt("invalid")).toThrow()
    })
    it("ENCRYPTION_KEY 未設定で throw", () => {
      delete process.env.ENCRYPTION_KEY
      expect(() => encrypt("x")).toThrow()
    })
  })
})
```

### Controller integration

```typescript
describe("POST /api/credentials", () => {
  describe("正常系", () => {
    it("201 で credential を作成し、DB の値は暗号化されている", async () => {
      const res = await request(app).post("/api/credentials").set("Cookie", cookie).send({
        name: "My OpenAI",
        type: "OPENAI",
        value: "sk-realkey1234567890",
      })
      expect(res.status).toBe(201)
      expect(res.body.maskedValue).toBe("sk-r****")
      const row = await testPrisma.credential.findUnique({ where: { id: res.body.id } })
      expect(row?.encryptedValue).not.toContain("sk-realkey")
      expect(decrypt(row!.encryptedValue)).toBe("sk-realkey1234567890")
    })
  })
})
```
