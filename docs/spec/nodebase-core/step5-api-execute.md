# step5-api-execute: 実行起動 + Execution 履歴 API

ワークフローの起動エンドポイントと、実行履歴の参照エンドポイントを追加する。起動は **Execution を `RUNNING` で先に作成 → BullMQ にジョブを enqueue → 202 Accepted を返す** 流れ。

## 対応内容

### 1. WorkflowExecutionJob 型を `packages/queue` に追加

`packages/queue/src/jobs/workflow-execution-job.ts`:

```typescript
import { z } from "zod"

export const WORKFLOW_EXECUTION_QUEUE_NAME = "workflow-execution" as const

export const workflowExecutionJobSchema = z.object({
  executionId: z.string(),
})
export type WorkflowExecutionJob = z.infer<typeof workflowExecutionJobSchema>
```

`packages/queue/src/jobs/index.ts` から re-export。`packages/queue` の build を忘れずに。

### 2. Schema

`packages/schema/src/api-schema/execution.ts`:

```typescript
import { z } from "zod"

export const executionStatusSchema = z.enum(["RUNNING", "SUCCESS", "FAILED"])
export const triggerTypeSchema = z.enum(["MANUAL", "WEBHOOK"])

export const executionSchema = z.object({
  completedAt: z.string().datetime().nullable(),
  error: z.string().nullable(),
  failedNodeId: z.string().nullable(),
  id: z.string(),
  startedAt: z.string().datetime(),
  status: executionStatusSchema,
  triggerType: triggerTypeSchema,
  workflowId: z.string(),
  workflowName: z.string(),
})

export const startExecutionResponseSchema = z.object({
  executionId: z.string(),
})

export const listExecutionsResponseSchema = z.object({
  executions: z.array(executionSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
})

export const executionDetailResponseSchema = executionSchema.extend({
  errorStack: z.string().nullable(),
  output: z.record(z.unknown()).nullable(),
})
```

### 3. Execution Repository

```typescript
export type CreateExecutionInput = {
  userId: number
  workflowId: string
  triggerType: "MANUAL" | "WEBHOOK"
}

export interface ExecutionRepository {
  create(input: CreateExecutionInput): Promise<Execution>
  findByIdForUser(id: string, userId: number): Promise<ExecutionWithWorkflowName | null>
  findManyByUser(userId: number, page: number, pageSize: number): Promise<{ rows: ExecutionWithWorkflowName[], total: number }>
}
```

実装は他 Repository と同パターン。`findManyByUser` は `include: { workflow: { select: { name: true } } }` を付ける。

### 4. Service

`apps/api/src/service/execution-service.ts`:

```typescript
import type { JobQueue } from "@repo/queue"
import { WORKFLOW_EXECUTION_QUEUE_NAME, type WorkflowExecutionJob } from "@repo/queue"

export const startWorkflowExecution = async (
  workflowId: string, userId: number,
  repo: {
    workflowRepository: WorkflowRepository
    executionRepository: ExecutionRepository
  },
  deps: { queue: JobQueue<WorkflowExecutionJob> }
): Promise<Result<{ executionId: string }>> => {
  /** workflow の存在と所有確認 */
  const workflow = await repo.workflowRepository.findByIdForUser(workflowId, userId)
  if (!workflow) return err(notFoundError("Workflow not found"))

  /** トリガーノードが少なくとも 1 つ存在することを確認 */
  const hasTrigger = workflow.nodes.some(
    (n) => n.nodeType === "MANUAL_TRIGGER" || n.nodeType === "WEBHOOK_TRIGGER"
  )
  if (!hasTrigger) return err(badRequestError("Workflow has no trigger node"))

  /** Execution を RUNNING で作成 */
  const execution = await repo.executionRepository.create({
    triggerType: "MANUAL",
    userId,
    workflowId,
  })

  /** Queue に enqueue */
  await deps.queue.add(WORKFLOW_EXECUTION_QUEUE_NAME, { executionId: execution.id })

  return ok({ executionId: execution.id })
}

export const listExecutions = async (
  userId: number, page: number, pageSize: number,
  repo: { executionRepository: ExecutionRepository }
): Promise<Result<{ rows: Execution[], page: number, pageSize: number, total: number }>> => {
  const { rows, total } = await repo.executionRepository.findManyByUser(userId, page, pageSize)
  return ok({ page, pageSize, rows, total })
}

export const getExecutionDetail = async (
  id: string, userId: number,
  repo: { executionRepository: ExecutionRepository }
): Promise<Result<ExecutionWithWorkflowName>> => {
  const detail = await repo.executionRepository.findByIdForUser(id, userId)
  if (!detail) return err(notFoundError("Execution not found"))
  return ok(detail)
}
```

### 5. Controller / Router

- `POST /api/workflows/:id/execute` → `ExecuteWorkflowController`（202 を返す）
- `GET /api/executions?page=&pageSize=` → `ListExecutionsController`
- `GET /api/executions/:id` → `ExecutionDetailController`

execute コントローラは Workflow router の中ではなく `executionRouter` に置く（実行と読み取りで関心が分かれるため）:

```typescript
app.use("/api/workflows/:id/execute", executeWorkflowRouter({ ... }))
app.use("/api/executions", executionRouter({ ... }))
```

### 6. DI

`apps/api/src/index.ts` で BullMQ Queue を初期化して Service に DI:

```typescript
import { createBullMqJobQueue } from "@repo/queue/bullmq"

const workflowExecutionQueue = createBullMqJobQueue<WorkflowExecutionJob>({
  connection: redis,
  queueName: WORKFLOW_EXECUTION_QUEUE_NAME,
})

const executeWorkflowController = new ExecuteWorkflowController(
  workflowRepository, executionRepository, workflowExecutionQueue,
)
```

## 動作確認

### Service ユニットテスト

```typescript
describe("startWorkflowExecution", () => {
  describe("正常系", () => {
    it("Execution を RUNNING で作成し、Queue に enqueue する", async () => {
      const mockQueue = { add: vi.fn() }
      const mockWorkflowRepo = { findByIdForUser: vi.fn().mockResolvedValue({
        ...fakeWorkflow,
        nodes: [{ nodeType: "MANUAL_TRIGGER" }],
      }) }
      const mockExecRepo = { create: vi.fn().mockResolvedValue({ id: "exec-1" }) }
      const result = await startWorkflowExecution("wf-1", 1,
        { executionRepository: mockExecRepo as any, workflowRepository: mockWorkflowRepo as any },
        { queue: mockQueue as any })
      expect(result.ok).toBe(true)
      expect(mockQueue.add).toHaveBeenCalledWith("workflow-execution", { executionId: "exec-1" })
    })
  })
  describe("異常系", () => {
    it("トリガーノードが無いと 400", async () => {
      const mockWorkflowRepo = { findByIdForUser: vi.fn().mockResolvedValue({
        ...fakeWorkflow, nodes: [{ nodeType: "HTTP_REQUEST" }],
      }) }
      const result = await startWorkflowExecution(/* ... */)
      if (!result.ok) {
        expect(result.error.type).toBe("BAD_REQUEST")
      }
    })
    it("他人の workflow で 404", async () => { /** ... */ })
  })
})
```

### Controller integration

```typescript
describe("POST /api/workflows/:id/execute", () => {
  describe("正常系", () => {
    it("202 で executionId を返し、DB に Execution が RUNNING で作成される", async () => {
      const res = await request(app)
        .post(`/api/workflows/${workflowId}/execute`)
        .set("Cookie", cookie)
        .send({})
      expect(res.status).toBe(202)
      expect(res.body).toEqual({ executionId: expect.any(String) })
      const exec = await testPrisma.execution.findUnique({ where: { id: res.body.executionId } })
      expect(exec?.status).toBe("RUNNING")
    })
  })
})
```

### 手動確認

```bash
# 起動
docker compose up -d
pnpm --filter api dev

# Workflow を作る → Manual Trigger ノードを足す → 実行
curl -X POST http://localhost:8080/api/workflows/$WID/execute --cookie cookies.txt
# => 202 {"executionId":"..."}

# 状態を polling
curl http://localhost:8080/api/executions/$EID --cookie cookies.txt
```
