# step1-db-schema: Prisma スキーマ + 初回マイグレーション

`packages/db/prisma/schema.prisma` に nodebase-core の 5 モデル（Workflow / WorkflowNode / WorkflowEdge / Credential / Execution）を追加する。既存の `User` / `AuthAccount` モデルは活用し、`Memo` モデルはテンプレ残骸として削除する。

## 対応内容

### 1. 既存モデルから不要分を削除

`packages/db/prisma/schema.prisma` から `Memo` モデルとその `@@map("memos")` 行を削除する。`AuthAccount` / `User` は残す。

```diff
-// メモ
-model Memo {
-    id        Int      @id @default(autoincrement())
-    title     String   @db.VarChar(255)
-    body      String   @db.Text
-    createdAt DateTime @default(now()) @map("created_at")
-    updatedAt DateTime @updatedAt @map("updated_at")
-
-    @@map("memos")
-}
```

### 2. nodebase-core のモデルを追加

スキーマ命名規則: **snake_case + `@@map`**（CLAUDE.md / 既存モデルと統一）。ID は `cuid()` 文字列。

```prisma
/**
 * ワークフロー本体
 */
model Workflow {
    id        String   @id @default(cuid())
    userId    Int      @map("user_id")
    name      String   @db.VarChar(255)
    active    Boolean  @default(false)
    createdAt DateTime @default(now()) @map("created_at")
    updatedAt DateTime @updatedAt @map("updated_at")

    user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)
    nodes      WorkflowNode[]
    edges      WorkflowEdge[]
    executions Execution[]

    @@index([userId])
    @@map("workflows")
}

/**
 * ワークフロー上のノード
 * data: ノード種別ごとの設定（HTTP の URL / OpenAI の prompt 等）
 * variableName: context 上のキー名（例: "node1" / "trigger" 等）
 * webhookKey: Webhook Trigger ノードのみ非 NULL（UUID v4）
 */
model WorkflowNode {
    id           String   @id @default(cuid())
    workflowId   String   @map("workflow_id")
    nodeType     String   @map("node_type") @db.VarChar(64)
    name         String   @db.VarChar(255)
    variableName String   @map("variable_name") @db.VarChar(64)
    positionX    Float    @map("position_x")
    positionY    Float    @map("position_y")
    data         Json     @default("{}")
    credentialId String?  @map("credential_id")
    webhookKey   String?  @unique @map("webhook_key")
    createdAt    DateTime @default(now()) @map("created_at")
    updatedAt    DateTime @updatedAt @map("updated_at")

    workflow   Workflow       @relation(fields: [workflowId], references: [id], onDelete: Cascade)
    credential Credential?    @relation(fields: [credentialId], references: [id], onDelete: SetNull)
    outgoing   WorkflowEdge[] @relation("FromNode")
    incoming   WorkflowEdge[] @relation("ToNode")

    @@index([workflowId])
    @@map("workflow_nodes")
}

/**
 * ワークフロー上のエッジ（ノード間接続）
 * MVP は単一ポート（main → main）のみ。複数出力ポートは将来
 */
model WorkflowEdge {
    id         String   @id @default(cuid())
    workflowId String   @map("workflow_id")
    fromNodeId String   @map("from_node_id")
    toNodeId   String   @map("to_node_id")
    createdAt  DateTime @default(now()) @map("created_at")
    updatedAt  DateTime @updatedAt @map("updated_at")

    workflow Workflow     @relation(fields: [workflowId], references: [id], onDelete: Cascade)
    fromNode WorkflowNode @relation("FromNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
    toNode   WorkflowNode @relation("ToNode", fields: [toNodeId], references: [id], onDelete: Cascade)

    @@unique([fromNodeId, toNodeId])
    @@index([workflowId])
    @@map("workflow_edges")
}

/**
 * Credential（API key 等の秘密情報）
 * encryptedValue: AES-256-GCM 暗号化（iv:authTag:ciphertext を base64url）
 * type: "OPENAI" 等（packages/schema の Zod enum と同期）
 */
model Credential {
    id             String   @id @default(cuid())
    userId         Int      @map("user_id")
    name           String   @db.VarChar(255)
    type           String   @db.VarChar(64)
    encryptedValue String   @map("encrypted_value") @db.Text
    createdAt      DateTime @default(now()) @map("created_at")
    updatedAt      DateTime @updatedAt @map("updated_at")

    user  User           @relation(fields: [userId], references: [id], onDelete: Cascade)
    nodes WorkflowNode[]

    @@index([userId])
    @@map("credentials")
}

/**
 * ワークフロー 1 回分の実行履歴
 * status: "RUNNING" | "SUCCESS" | "FAILED"
 * triggerType: "MANUAL" | "WEBHOOK"
 * output: 全ノード実行後の最終 context（jsonb）
 */
model Execution {
    id            String    @id @default(cuid())
    workflowId    String    @map("workflow_id")
    userId        Int       @map("user_id")
    status        String    @db.VarChar(32)
    triggerType   String    @map("trigger_type") @db.VarChar(32)
    startedAt     DateTime  @default(now()) @map("started_at")
    completedAt   DateTime? @map("completed_at")
    output        Json?
    error         String?   @db.Text
    errorStack    String?   @map("error_stack") @db.Text
    failedNodeId  String?   @map("failed_node_id")

    workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
    user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, startedAt(sort: Desc)])
    @@index([workflowId, startedAt(sort: Desc)])
    @@map("executions")
}
```

### 3. User モデルにリレーション追加

```diff
 model User {
     id        Int      @id @default(autoincrement())
     email     String?  @unique
     ...
     accounts AuthAccount[]
+    workflows   Workflow[]
+    credentials Credential[]
+    executions  Execution[]

     @@map("users")
 }
```

### 4. マイグレーション生成

```bash
cd packages/db
DB_NAME=nodebase_dev pnpm db:migrate  # 開発 DB に対して migrate
```

マイグレーション名: `nodebase_core_init`

### 5. seed の調整（任意）

`packages/db/prisma/seed.ts` を確認し、`Memo` への seed 投入があれば削除する。MVP ではワークフローの seed は不要（手動で UI から作成して確認）。

## 動作確認

### 1. スキーマ整合性

```bash
cd packages/db
pnpm build              # tsc が通る
pnpm db:generate        # Prisma Client が生成される
```

### 2. マイグレーション適用

```bash
# dev DB
docker compose up -d postgres
DB_NAME=nodebase_dev dotenvx run -f apps/api/.env.local -- pnpm --filter @repo/db db:migrate

# test DB（apps/api のテスト用）
DB_NAME=nodebase_test dotenvx run -f apps/api/.env.local -- pnpm --filter @repo/db db:migrate:deploy
```

### 3. テーブル確認

```bash
docker exec -i nodebase-postgres psql -U postgres -d nodebase_dev -c "\dt"
```

`workflows / workflow_nodes / workflow_edges / credentials / executions` が表示されれば OK。`memos` テーブルが消えていることも確認。

### 4. インデックス確認

```bash
docker exec -i nodebase-postgres psql -U postgres -d nodebase_dev -c "\d workflow_nodes"
```

`workflow_nodes_webhook_key_key` (unique) と `workflow_nodes_workflow_id_idx` が存在することを確認。
