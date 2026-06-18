# step7-worker-executor: BullMQ ワーカーで DAG 実行

`apps/worker` に WorkflowExecutor を実装する。ジョブを受け取り、ノード順に executor を呼び、結果を Execution に書き戻す。

## 対応内容

### 1. ファイル構成

```
apps/worker/src/
├── workers/
│   └── workflow-execution-worker.ts       # BullMQ job → executor 呼び出し
├── executor/
│   ├── workflow-executor.ts               # DAG ソート + 各ノード逐次実行
│   ├── node-executor-registry.ts          # NodeType → NodeExecutor 解決
│   ├── template.ts                        # Handlebars テンプレ展開
│   ├── encryption.ts                      # apps/api と同じ AES-256-GCM 実装
│   └── nodes/
│       ├── types.ts                       # NodeExecutor 共通型
│       ├── manual-trigger.ts
│       ├── webhook-trigger.ts
│       ├── http-request.ts
│       └── openai.ts
└── repository/
    ├── workflow-repository.ts             # apps/api と同じ（Detail のみ）
    ├── execution-repository.ts            # markRunning / markSuccess / markFailed
    └── credential-repository.ts           # findByIdForUser（encryptedValue 返す）
```

`apps/api` と Repository コードは完全には共有しない（依存方向が混乱する）。Worker 側は worker が必要なメソッドだけ持つ最小実装にする。**`encryption.ts` だけは API 側からコピー**（共通化したくなったら `packages/crypto` を切る）。

### 2. NodeExecutor 共通型

`apps/worker/src/executor/nodes/types.ts`:

```typescript
import type { ILogger } from "@repo/logger"
import type { CredentialRepository } from "../../repository/credential-repository"

export type WorkflowContext = Record<string, unknown>

export type NodeExecutorParams<TConfig = Record<string, unknown>> = {
  config: TConfig            /** ノード data を展開済み */
  context: WorkflowContext   /** 前ノードの出力を含む context */
  nodeId: string
  userId: number
  deps: {
    credentialRepository: CredentialRepository
    logger: ILogger
  }
}

export type NodeExecutor<TConfig = Record<string, unknown>, TOutput = unknown> = (
  params: NodeExecutorParams<TConfig>
) => Promise<TOutput>
```

### 3. テンプレ展開

`apps/worker/src/executor/template.ts`:

```typescript
import Handlebars from "handlebars"

/**
 * 文字列を Handlebars テンプレとして展開する。
 * 文字列以外はそのまま返す（ネスト構造は再帰展開）
 */
export const expandTemplate = (value: unknown, context: Record<string, unknown>): unknown => {
  if (typeof value === "string") {
    const template = Handlebars.compile(value, { noEscape: true })
    return template(context)
  }
  if (Array.isArray(value)) return value.map((v) => expandTemplate(v, context))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = expandTemplate(v, context)
    return out
  }
  return value
}
```

### 4. ノード Executor の実装

#### Manual Trigger

`apps/worker/src/executor/nodes/manual-trigger.ts`:

```typescript
import type { NodeExecutor } from "./types"

export const manualTriggerExecutor: NodeExecutor = async () => {
  return { triggeredAt: new Date().toISOString() }
}
```

#### Webhook Trigger

```typescript
export const webhookTriggerExecutor: NodeExecutor = async ({ context }) => {
  /** Webhook 受信時に Execution.output.__webhook に payload が入っている */
  const payload = (context.__webhook as Record<string, unknown>) || {}
  return payload  /** { headers, query, body, method } */
}
```

#### HTTP Request

```typescript
import ky from "ky"
import type { NodeExecutor } from "./types"
import { expandTemplate } from "../template"

type HttpRequestConfig = {
  url: string
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  headers?: Record<string, string>
  body?: string
}

export const httpRequestExecutor: NodeExecutor<HttpRequestConfig> = async ({ config, context, deps }) => {
  const expanded = expandTemplate(config, context) as HttpRequestConfig
  deps.logger.debug("http-request: sending", { method: expanded.method, url: expanded.url })

  const response = await ky(expanded.url, {
    body: expanded.body,
    headers: expanded.headers,
    method: expanded.method || "GET",
    throwHttpErrors: false,
    timeout: 30_000,
  })

  const contentType = response.headers.get("content-type") || ""
  let body: unknown
  if (contentType.includes("application/json")) {
    body = await response.json()
  } else {
    body = await response.text()
  }

  return {
    body,
    headers: Object.fromEntries(response.headers.entries()),
    status: response.status,
  }
}
```

#### OpenAI

```typescript
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { NodeExecutor } from "./types"
import { expandTemplate } from "../template"
import { decrypt } from "../encryption"

type OpenAiConfig = {
  credentialId: string
  model: string  /** "gpt-4o-mini" 等 */
  systemPrompt?: string
  userPrompt: string
}

export const openAiExecutor: NodeExecutor<OpenAiConfig> = async ({ config, context, userId, deps }) => {
  const credential = await deps.credentialRepository.findByIdForUser(config.credentialId, userId)
  if (!credential) throw new Error(`Credential ${config.credentialId} not found`)
  if (credential.type !== "OPENAI") throw new Error(`Credential type mismatch: ${credential.type}`)

  const apiKey = decrypt(credential.encryptedValue)
  const openai = createOpenAI({ apiKey })

  const expandedSystem = config.systemPrompt
    ? (expandTemplate(config.systemPrompt, context) as string)
    : undefined
  const expandedUser = expandTemplate(config.userPrompt, context) as string

  const result = await generateText({
    messages: [
      ...(expandedSystem ? [{ content: expandedSystem, role: "system" as const }] : []),
      { content: expandedUser, role: "user" as const },
    ],
    model: openai(config.model),
  })

  return {
    text: result.text,
    usage: result.usage,
  }
}
```

### 5. レジストリ

`apps/worker/src/executor/node-executor-registry.ts`:

```typescript
import { manualTriggerExecutor } from "./nodes/manual-trigger"
import { webhookTriggerExecutor } from "./nodes/webhook-trigger"
import { httpRequestExecutor } from "./nodes/http-request"
import { openAiExecutor } from "./nodes/openai"
import type { NodeExecutor } from "./nodes/types"

const REGISTRY: Record<string, NodeExecutor<any, any>> = {
  HTTP_REQUEST: httpRequestExecutor,
  MANUAL_TRIGGER: manualTriggerExecutor,
  OPENAI: openAiExecutor,
  WEBHOOK_TRIGGER: webhookTriggerExecutor,
}

export const getNodeExecutor = (nodeType: string): NodeExecutor => {
  const executor = REGISTRY[nodeType]
  if (!executor) throw new Error(`Unknown nodeType: ${nodeType}`)
  return executor
}
```

### 6. DAG ソート

`apps/worker/src/executor/topological-sort.ts`:

```typescript
import toposort from "toposort"
import type { WorkflowNode, WorkflowEdge } from "../types/workflow"

export const sortNodes = (nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] => {
  const edgeList: [string, string][] = edges.map((e) => [e.fromNodeId, e.toNodeId])
  /** 孤立ノード（接続を持たない）も自己ループとして edgeList に入れて落ちないようにする */
  for (const n of nodes) {
    if (!edges.some((e) => e.fromNodeId === n.id || e.toNodeId === n.id)) {
      edgeList.push([n.id, n.id])
    }
  }
  const sortedIds = toposort(edgeList)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  return sortedIds.map((id) => nodeById.get(id)).filter((n): n is WorkflowNode => Boolean(n))
}
```

`toposort` が循環検出時に throw するので、ここで catch せずそのまま伝播 → WorkflowExecutor が `FAILED` で記録。

### 7. WorkflowExecutor

`apps/worker/src/executor/workflow-executor.ts`:

```typescript
export const executeWorkflow = async (
  executionId: string,
  repos: { workflowRepository: WorkflowRepository, executionRepository: ExecutionRepository, credentialRepository: CredentialRepository },
  logger: ILogger,
): Promise<void> => {
  const execution = await repos.executionRepository.findById(executionId)
  if (!execution) throw new Error(`Execution ${executionId} not found`)

  const workflow = await repos.workflowRepository.findDetail(execution.workflowId)
  if (!workflow) {
    await repos.executionRepository.markFailed(executionId, "Workflow not found", null)
    return
  }

  /** Execution.output に初期 context（webhook payload 等）が入っているなら採用 */
  let context: WorkflowContext = (execution.output as Record<string, unknown>) || {}
  const sorted = sortNodes(workflow.nodes, workflow.edges)

  for (const node of sorted) {
    try {
      const executor = getNodeExecutor(node.nodeType)
      const output = await executor({
        config: node.data,
        context,
        deps: { credentialRepository: repos.credentialRepository, logger },
        nodeId: node.id,
        userId: execution.userId,
      })
      context[node.variableName] = output
      logger.debug("node completed", { nodeId: node.id, variableName: node.variableName })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error("node failed", { error: error.message, nodeId: node.id, stack: error.stack })
      await repos.executionRepository.markFailed(executionId, error.message, error.stack ?? null, node.id, context)
      return
    }
  }

  await repos.executionRepository.markSuccess(executionId, context)
}
```

### 8. BullMQ Worker

`apps/worker/src/workers/workflow-execution-worker.ts`:

```typescript
import { Worker } from "bullmq"
import { WORKFLOW_EXECUTION_QUEUE_NAME, workflowExecutionJobSchema } from "@repo/queue"

export const startWorkflowExecutionWorker = (deps: {
  redisConnection: Redis
  workflowRepository: WorkflowRepository
  executionRepository: ExecutionRepository
  credentialRepository: CredentialRepository
  logger: ILogger
}): Worker => {
  return new Worker(
    WORKFLOW_EXECUTION_QUEUE_NAME,
    async (job) => {
      const payload = workflowExecutionJobSchema.parse(job.data)
      await executeWorkflow(payload.executionId,
        {
          credentialRepository: deps.credentialRepository,
          executionRepository: deps.executionRepository,
          workflowRepository: deps.workflowRepository,
        },
        deps.logger,
      )
    },
    {
      concurrency: 5,
      connection: deps.redisConnection,
    },
  )
}
```

`attempts: 1`（リトライ無効）はジョブ追加側（API）で指定するのが原則。Worker 側は受け取るだけ。

### 9. ExecutionRepository に状態遷移メソッド追加

```typescript
public async markSuccess(id: string, output: Record<string, unknown>): Promise<void> {
  await this._prisma.execution.update({
    data: { completedAt: new Date(), output, status: "SUCCESS" },
    where: { id },
  })
}

public async markFailed(id: string, error: string, errorStack: string | null, failedNodeId?: string, output?: Record<string, unknown>): Promise<void> {
  await this._prisma.execution.update({
    data: {
      completedAt: new Date(),
      error,
      errorStack,
      failedNodeId: failedNodeId ?? null,
      output: output ?? undefined,
      status: "FAILED",
    },
    where: { id },
  })
}
```

## 動作確認

### Worker ユニットテスト

#### Template

```typescript
describe("expandTemplate", () => {
  describe("正常系", () => {
    it("ネストしたオブジェクトを再帰展開する", () => {
      expect(expandTemplate({ a: "{{x}}", b: ["{{y}}"] }, { x: "1", y: "2" }))
        .toEqual({ a: "1", b: ["2"] })
    })
    it("非文字列はそのまま返す", () => {
      expect(expandTemplate(42, {})).toBe(42)
    })
  })
})
```

#### WorkflowExecutor

```typescript
describe("executeWorkflow", () => {
  describe("正常系", () => {
    it("Manual → HTTP の順で実行し、SUCCESS で書き戻される", async () => {
      /** Workflow を seed → executeWorkflow(executionId) → DB を assert */
    })
    it("HTTP の前段の出力を {{trigger.xxx}} で参照できる", async () => { /** ... */ })
  })
  describe("異常系", () => {
    it("ノード内で throw されたら FAILED + failedNodeId が記録される", async () => { /** ... */ })
    it("循環があるワークフローは FAILED", async () => { /** ... */ })
  })
})
```

### 統合テスト（API → Queue → Worker → DB の e2e）

apps/api / apps/worker の両方を本物の Redis に対して起動し、`POST /api/workflows/:id/execute` → polling → `SUCCESS` まで確認するシナリオを 1 本書く（CI では skip 可、ローカルでの sanity check 用）。
