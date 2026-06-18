# step2-api-workflow-crud: Workflow CRUD API

`apps/api` に Workflow の CRUD エンドポイント 5 本（list / create / detail / patch / delete）を追加する。CLAUDE.md のレイヤード（Repository → Service → Controller → Router）に準拠。

## 対応内容

### 1. `@repo/api-schema` のスキーマ追加

`packages/schema/src/api-schema/workflow.ts` を新規作成。

```typescript
import { z } from "zod"

export const workflowSchema = z.object({
  active: z.boolean(),
  createdAt: z.string().datetime(),
  id: z.string(),
  name: z.string(),
  updatedAt: z.string().datetime(),
})

/** GET /api/workflows */
export const listWorkflowsResponseSchema = z.object({
  workflows: z.array(workflowSchema),
})

/** POST /api/workflows */
export const createWorkflowRequestSchema = z.object({
  name: z.string().min(1).max(255),
})
export const createWorkflowResponseSchema = workflowSchema

/** GET /api/workflows/:id (nodes/edges を含む) */
export const workflowDetailResponseSchema = workflowSchema.extend({
  edges: z.array(z.object({
    fromNodeId: z.string(),
    id: z.string(),
    toNodeId: z.string(),
  })),
  nodes: z.array(z.object({
    credentialId: z.string().nullable(),
    data: z.record(z.unknown()),
    id: z.string(),
    name: z.string(),
    nodeType: z.string(),
    positionX: z.number(),
    positionY: z.number(),
    variableName: z.string(),
    webhookKey: z.string().nullable(),
  })),
})

/** PATCH /api/workflows/:id */
export const updateWorkflowRequestSchema = z.object({
  active: z.boolean().optional(),
  name: z.string().min(1).max(255).optional(),
})
export const updateWorkflowResponseSchema = workflowSchema
```

`packages/schema/src/api-schema/index.ts` から re-export し、`pnpm --filter @repo/api-schema build`。

### 2. Domain 型

`apps/api/src/types/domain/workflow.ts`:

```typescript
export type Workflow = {
  id: string
  userId: number
  name: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type WorkflowDetail = Workflow & {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type WorkflowNode = {
  id: string
  workflowId: string
  nodeType: string
  name: string
  variableName: string
  positionX: number
  positionY: number
  data: Record<string, unknown>
  credentialId: string | null
  webhookKey: string | null
}

export type WorkflowEdge = {
  id: string
  workflowId: string
  fromNodeId: string
  toNodeId: string
}
```

### 3. Repository

`apps/api/src/repository/prisma/workflow-repository.ts`:

```typescript
import type { PrismaClient } from "@repo/db"

import type { Workflow, WorkflowDetail } from "../../types/domain/workflow"

export type CreateWorkflowInput = { userId: number, name: string }
export type UpdateWorkflowInput = { active?: boolean, name?: string }

export interface WorkflowRepository {
  findManyByUser(userId: number): Promise<Workflow[]>
  findByIdForUser(id: string, userId: number): Promise<WorkflowDetail | null>
  create(input: CreateWorkflowInput): Promise<Workflow>
  update(id: string, userId: number, input: UpdateWorkflowInput): Promise<Workflow | null>
  delete(id: string, userId: number): Promise<boolean>
}

export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly _prisma: PrismaClient) {}

  public async findManyByUser(userId: number): Promise<Workflow[]> {
    const rows = await this._prisma.workflow.findMany({
      orderBy: { updatedAt: "desc" },
      where: { userId },
    })
    return rows.map((r) => this._toDomain(r))
  }

  public async findByIdForUser(id: string, userId: number): Promise<WorkflowDetail | null> {
    const row = await this._prisma.workflow.findFirst({
      include: { edges: true, nodes: true },
      where: { id, userId },
    })
    if (!row) return null
    return {
      ...this._toDomain(row),
      edges: row.edges.map((e) => ({
        fromNodeId: e.fromNodeId,
        id: e.id,
        toNodeId: e.toNodeId,
        workflowId: e.workflowId,
      })),
      nodes: row.nodes.map((n) => ({
        credentialId: n.credentialId,
        data: n.data as Record<string, unknown>,
        id: n.id,
        name: n.name,
        nodeType: n.nodeType,
        positionX: n.positionX,
        positionY: n.positionY,
        variableName: n.variableName,
        webhookKey: n.webhookKey,
        workflowId: n.workflowId,
      })),
    }
  }

  public async create(input: CreateWorkflowInput): Promise<Workflow> {
    const row = await this._prisma.workflow.create({
      data: { active: false, name: input.name, userId: input.userId },
    })
    return this._toDomain(row)
  }

  public async update(
    id: string, userId: number, input: UpdateWorkflowInput
  ): Promise<Workflow | null> {
    const result = await this._prisma.workflow.updateMany({
      data: input,
      where: { id, userId },
    })
    if (result.count === 0) return null
    const row = await this._prisma.workflow.findUniqueOrThrow({ where: { id } })
    return this._toDomain(row)
  }

  public async delete(id: string, userId: number): Promise<boolean> {
    const result = await this._prisma.workflow.deleteMany({ where: { id, userId } })
    return result.count > 0
  }

  private _toDomain(row: { id: string, userId: number, name: string, active: boolean, createdAt: Date, updatedAt: Date }): Workflow {
    return {
      active: row.active,
      createdAt: row.createdAt,
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
      userId: row.userId,
    }
  }
}
```

### 4. Service

`apps/api/src/service/workflow-service.ts`:

```typescript
import { err, notFoundError, ok, type Result } from "../types/result"
import type { Workflow, WorkflowDetail } from "../types/domain/workflow"
import type { WorkflowRepository } from "../repository/prisma/workflow-repository"

export const listWorkflows = async (
  userId: number,
  repo: { workflowRepository: WorkflowRepository }
): Promise<Result<Workflow[]>> => {
  const workflows = await repo.workflowRepository.findManyByUser(userId)
  return ok(workflows)
}

export const createWorkflow = async (
  userId: number, name: string,
  repo: { workflowRepository: WorkflowRepository }
): Promise<Result<Workflow>> => {
  const workflow = await repo.workflowRepository.create({ name, userId })
  return ok(workflow)
}

export const getWorkflowDetail = async (
  id: string, userId: number,
  repo: { workflowRepository: WorkflowRepository }
): Promise<Result<WorkflowDetail>> => {
  const detail = await repo.workflowRepository.findByIdForUser(id, userId)
  if (!detail) return err(notFoundError("Workflow not found"))
  return ok(detail)
}

export const updateWorkflow = async (
  id: string, userId: number, input: { name?: string, active?: boolean },
  repo: { workflowRepository: WorkflowRepository }
): Promise<Result<Workflow>> => {
  const updated = await repo.workflowRepository.update(id, userId, input)
  if (!updated) return err(notFoundError("Workflow not found"))
  return ok(updated)
}

export const deleteWorkflow = async (
  id: string, userId: number,
  repo: { workflowRepository: WorkflowRepository }
): Promise<Result<{ message: string }>> => {
  const deleted = await repo.workflowRepository.delete(id, userId)
  if (!deleted) return err(notFoundError("Workflow not found"))
  return ok({ message: "OK" })
}
```

`apps/api/src/service/index.ts` から `export * as workflow from "./workflow-service"` でバレル。

### 5. Controller（5 ファイル）

`apps/api/src/controller/workflow/{list,create,detail,update,delete}.ts` を作成。`memo` コントローラを参考に各 1 つ。

例: `apps/api/src/controller/workflow/list.ts`:

```typescript
import type { Request, Response } from "express"
import { listWorkflowsResponseSchema } from "@repo/api-schema"

import { parseResponse } from "../../lib/parse-schema"
import { sendError } from "../../lib/send-error"
import * as service from "../../service"
import type { WorkflowRepository } from "../../repository/prisma/workflow-repository"

export class WorkflowListController {
  constructor(private readonly _workflowRepository: WorkflowRepository) {}

  public async execute(req: Request, res: Response) {
    const userId = req.user!.id
    const result = await service.workflow.listWorkflows(userId, {
      workflowRepository: this._workflowRepository,
    })
    if (!result.ok) return sendError(req, res, result.error)
    const body = parseResponse(listWorkflowsResponseSchema, {
      workflows: result.value.map((w) => ({
        active: w.active,
        createdAt: w.createdAt.toISOString(),
        id: w.id,
        name: w.name,
        updatedAt: w.updatedAt.toISOString(),
      })),
    })
    return res.status(200).json(body)
  }
}
```

他 4 つ（create / detail / update / delete）も同パターンで作成。

### 6. Router

`apps/api/src/routes/workflow-router.ts`:

```typescript
import { Router } from "express"
import type { WorkflowListController } from "../controller/workflow/list"
import type { WorkflowCreateController } from "../controller/workflow/create"
import type { WorkflowDetailController } from "../controller/workflow/detail"
import type { WorkflowUpdateController } from "../controller/workflow/update"
import type { WorkflowDeleteController } from "../controller/workflow/delete"

export type WorkflowRouterControllers = {
  create?: WorkflowCreateController
  delete?: WorkflowDeleteController
  detail?: WorkflowDetailController
  list?: WorkflowListController
  update?: WorkflowUpdateController
}

export const workflowRouter = (c: WorkflowRouterControllers): Router => {
  const r = Router()
  if (c.list) r.get("/", (req, res) => c.list!.execute(req, res))
  if (c.create) r.post("/", (req, res) => c.create!.execute(req, res))
  if (c.detail) r.get("/:id", (req, res) => c.detail!.execute(req, res))
  if (c.update) r.patch("/:id", (req, res) => c.update!.execute(req, res))
  if (c.delete) r.delete("/:id", (req, res) => c.delete!.execute(req, res))
  return r
}
```

### 7. DI 組み立て

`apps/api/src/index.ts` で:

```typescript
const workflowRepository = new PrismaWorkflowRepository(prisma)
app.use("/api/workflows", workflowRouter({
  create: new WorkflowCreateController(workflowRepository),
  delete: new WorkflowDeleteController(workflowRepository),
  detail: new WorkflowDetailController(workflowRepository),
  list: new WorkflowListController(workflowRepository),
  update: new WorkflowUpdateController(workflowRepository),
}))
```

## 動作確認

### Service ユニットテスト

`apps/api/test/service/workflow-service.test.ts`:

```typescript
describe("listWorkflows", () => {
  describe("正常系", () => {
    it("ユーザーの workflow 一覧を返す", async () => {
      const mockRepo = { findManyByUser: vi.fn().mockResolvedValue([fakeWorkflow]) }
      const result = await listWorkflows(1, { workflowRepository: mockRepo as any })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.value).toHaveLength(1)
    })
  })
})

describe("getWorkflowDetail", () => {
  describe("正常系", () => {
    it("自分の workflow 詳細を返す", async () => { /** ... */ })
  })
  describe("異常系", () => {
    it("存在しない id で NOT_FOUND", async () => {
      const mockRepo = { findByIdForUser: vi.fn().mockResolvedValue(null) }
      const result = await getWorkflowDetail("x", 1, { workflowRepository: mockRepo as any })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.type).toBe("NOT_FOUND")
    })
  })
})
```

### Controller インテグレーションテスト

`apps/api/test/controller/workflow/*.test.ts` で実 Postgres に対して supertest を使う。

```typescript
describe("POST /api/workflows", () => {
  describe("正常系", () => {
    it("201 で workflow を作成し、DB にレコードができる", async () => {
      const res = await request(app)
        .post("/api/workflows")
        .set("Cookie", await issueTestCookie(userId))
        .send({ name: "My first workflow" })
      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        active: false,
        createdAt: expect.any(String),
        id: expect.any(String),
        name: "My first workflow",
        updatedAt: expect.any(String),
      })
      const row = await testPrisma.workflow.findUnique({ where: { id: res.body.id } })
      expect(row).toMatchObject({ name: "My first workflow", userId })
    })
  })
  describe("異常系", () => {
    it("name 未指定で 400", async () => { /** ... */ })
    it("未認証で 401", async () => { /** ... */ })
  })
})
```

### 手動確認

```bash
# 1. dev サーバー起動
pnpm --filter api dev

# 2. dev-login で cookie 取得済みの状態で curl
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  --cookie cookies.txt \
  -d '{"name":"test workflow"}'

# 3. 一覧取得
curl http://localhost:8080/api/workflows --cookie cookies.txt
```
