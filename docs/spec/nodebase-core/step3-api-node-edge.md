# step3-api-node-edge: Workflow 内のノード / エッジ CRUD

Workflow の中身（ノード / エッジ）を編集する API を追加する。エディタ上のドラッグ&ドロップ操作 1 つにつき 1 リクエストの粒度。

## 対応内容

### 1. NodeType / TriggerType の Zod enum

`packages/schema/src/api-schema/workflow-node.ts`:

```typescript
import { z } from "zod"

/** ノード種別。新規ノード追加時にここに足す */
export const nodeTypeSchema = z.enum([
  "MANUAL_TRIGGER",
  "WEBHOOK_TRIGGER",
  "HTTP_REQUEST",
  "OPENAI",
])
export type NodeType = z.infer<typeof nodeTypeSchema>

export const createNodeRequestSchema = z.object({
  credentialId: z.string().nullable().optional(),
  data: z.record(z.unknown()).default({}),
  name: z.string().min(1).max(255),
  nodeType: nodeTypeSchema,
  positionX: z.number(),
  positionY: z.number(),
  variableName: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
})

export const updateNodeRequestSchema = z.object({
  credentialId: z.string().nullable().optional(),
  data: z.record(z.unknown()).optional(),
  name: z.string().min(1).max(255).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  variableName: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).optional(),
})

export const nodeResponseSchema = z.object({
  credentialId: z.string().nullable(),
  data: z.record(z.unknown()),
  id: z.string(),
  name: z.string(),
  nodeType: nodeTypeSchema,
  positionX: z.number(),
  positionY: z.number(),
  variableName: z.string(),
  webhookKey: z.string().nullable(),
})

export const createEdgeRequestSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
})

export const edgeResponseSchema = z.object({
  fromNodeId: z.string(),
  id: z.string(),
  toNodeId: z.string(),
})
```

### 2. Repository

`apps/api/src/repository/prisma/workflow-node-repository.ts`:

```typescript
import { randomUUID } from "node:crypto"
import type { PrismaClient } from "@repo/db"

import type { WorkflowNode } from "../../types/domain/workflow"

export type CreateNodeInput = Omit<WorkflowNode, "id" | "webhookKey"> & {
  webhookKey?: string | null
}

export interface WorkflowNodeRepository {
  create(workflowId: string, userId: number, input: CreateNodeInput): Promise<WorkflowNode | null>
  update(nodeId: string, userId: number, input: Partial<CreateNodeInput>): Promise<WorkflowNode | null>
  delete(nodeId: string, userId: number): Promise<boolean>
}

export class PrismaWorkflowNodeRepository implements WorkflowNodeRepository {
  constructor(private readonly _prisma: PrismaClient) {}

  public async create(workflowId: string, userId: number, input: CreateNodeInput): Promise<WorkflowNode | null> {
    const workflow = await this._prisma.workflow.findFirst({ where: { id: workflowId, userId } })
    if (!workflow) return null

    const webhookKey = input.nodeType === "WEBHOOK_TRIGGER" ? randomUUID() : null

    const row = await this._prisma.workflowNode.create({
      data: {
        credentialId: input.credentialId ?? null,
        data: input.data,
        name: input.name,
        nodeType: input.nodeType,
        positionX: input.positionX,
        positionY: input.positionY,
        variableName: input.variableName,
        webhookKey,
        workflowId,
      },
    })
    return this._toDomain(row)
  }

  public async update(nodeId: string, userId: number, input: Partial<CreateNodeInput>): Promise<WorkflowNode | null> {
    const node = await this._prisma.workflowNode.findFirst({
      include: { workflow: true },
      where: { id: nodeId, workflow: { userId } },
    })
    if (!node) return null
    const row = await this._prisma.workflowNode.update({
      data: {
        ...(input.credentialId !== undefined && { credentialId: input.credentialId }),
        ...(input.data !== undefined && { data: input.data }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.positionX !== undefined && { positionX: input.positionX }),
        ...(input.positionY !== undefined && { positionY: input.positionY }),
        ...(input.variableName !== undefined && { variableName: input.variableName }),
      },
      where: { id: nodeId },
    })
    return this._toDomain(row)
  }

  public async delete(nodeId: string, userId: number): Promise<boolean> {
    const result = await this._prisma.workflowNode.deleteMany({
      where: { id: nodeId, workflow: { userId } },
    })
    return result.count > 0
  }

  private _toDomain(row: { id: string, workflowId: string, nodeType: string, name: string, variableName: string, positionX: number, positionY: number, data: unknown, credentialId: string | null, webhookKey: string | null }): WorkflowNode {
    return {
      credentialId: row.credentialId,
      data: row.data as Record<string, unknown>,
      id: row.id,
      name: row.name,
      nodeType: row.nodeType,
      positionX: row.positionX,
      positionY: row.positionY,
      variableName: row.variableName,
      webhookKey: row.webhookKey,
      workflowId: row.workflowId,
    }
  }
}
```

### 3. Edge Repository

`apps/api/src/repository/prisma/workflow-edge-repository.ts`:

```typescript
import type { PrismaClient } from "@repo/db"

import type { WorkflowEdge } from "../../types/domain/workflow"

export interface WorkflowEdgeRepository {
  create(workflowId: string, userId: number, fromNodeId: string, toNodeId: string): Promise<WorkflowEdge | null>
  delete(edgeId: string, userId: number): Promise<boolean>
}

export class PrismaWorkflowEdgeRepository implements WorkflowEdgeRepository {
  constructor(private readonly _prisma: PrismaClient) {}

  public async create(workflowId: string, userId: number, fromNodeId: string, toNodeId: string): Promise<WorkflowEdge | null> {
    /** workflowId / fromNodeId / toNodeId が同じ user のものか確認 */
    const [workflow, fromNode, toNode] = await Promise.all([
      this._prisma.workflow.findFirst({ where: { id: workflowId, userId } }),
      this._prisma.workflowNode.findFirst({ where: { id: fromNodeId, workflowId } }),
      this._prisma.workflowNode.findFirst({ where: { id: toNodeId, workflowId } }),
    ])
    if (!workflow || !fromNode || !toNode) return null

    const row = await this._prisma.workflowEdge.create({
      data: { fromNodeId, toNodeId, workflowId },
    })
    return { fromNodeId: row.fromNodeId, id: row.id, toNodeId: row.toNodeId, workflowId: row.workflowId }
  }

  public async delete(edgeId: string, userId: number): Promise<boolean> {
    const result = await this._prisma.workflowEdge.deleteMany({
      where: { id: edgeId, workflow: { userId } },
    })
    return result.count > 0
  }
}
```

### 4. Service

`apps/api/src/service/workflow-node-service.ts`:

```typescript
/** addNode / updateNode / deleteNode / addEdge / deleteEdge を Result で返す */
export const addNode = async (
  workflowId: string, userId: number, input: CreateNodeInput,
  repo: { workflowNodeRepository: WorkflowNodeRepository }
): Promise<Result<WorkflowNode>> => {
  const node = await repo.workflowNodeRepository.create(workflowId, userId, input)
  if (!node) return err(notFoundError("Workflow not found"))
  return ok(node)
}

/** updateNode / deleteNode / addEdge / deleteEdge も同パターン */
```

### 5. Controller / Router

- `POST /api/workflows/:workflowId/nodes` → `AddNodeController`
- `PATCH /api/workflows/:workflowId/nodes/:nodeId` → `UpdateNodeController`
- `DELETE /api/workflows/:workflowId/nodes/:nodeId` → `DeleteNodeController`
- `POST /api/workflows/:workflowId/edges` → `AddEdgeController`
- `DELETE /api/workflows/:workflowId/edges/:edgeId` → `DeleteEdgeController`

Router は既存の `workflowRouter` の中にネストするのではなく、別 router として:

```typescript
app.use("/api/workflows/:workflowId/nodes", workflowNodeRouter({ ... }))
app.use("/api/workflows/:workflowId/edges", workflowEdgeRouter({ ... }))
```

### 6. ノード追加時の validation

- `WEBHOOK_TRIGGER` のときのみサーバ側で `webhookKey` を発番
- `data` の中身は **ノード種別ごとの Zod schema** で軽くチェック（厳格にすると編集途中 save できないため、保存時は loose、実行時に worker で strict にチェック）

## 動作確認

### Service ユニットテスト

```typescript
describe("addNode", () => {
  describe("正常系", () => {
    it("自分の workflow にノードを追加する", async () => { /** ... */ })
    it("WEBHOOK_TRIGGER のとき webhookKey が UUID で発番される", async () => { /** ... */ })
  })
  describe("異常系", () => {
    it("他人の workflow には追加できず NOT_FOUND を返す", async () => { /** ... */ })
  })
})
```

### Controller integration

```typescript
describe("POST /api/workflows/:workflowId/nodes", () => {
  describe("正常系", () => {
    it("HTTP_REQUEST ノードを追加する", async () => {
      const res = await request(app)
        .post(`/api/workflows/${workflowId}/nodes`)
        .set("Cookie", cookie)
        .send({
          data: { method: "GET", url: "https://example.com" },
          name: "Get example",
          nodeType: "HTTP_REQUEST",
          positionX: 100,
          positionY: 200,
          variableName: "example",
        })
      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        credentialId: null,
        data: { method: "GET", url: "https://example.com" },
        id: expect.any(String),
        name: "Get example",
        nodeType: "HTTP_REQUEST",
        positionX: 100,
        positionY: 200,
        variableName: "example",
        webhookKey: null,
      })
    })
    it("WEBHOOK_TRIGGER 追加時に webhookKey が発番される", async () => {
      const res = await request(app).post(`/api/workflows/${workflowId}/nodes`).set("Cookie", cookie).send({
        data: {},
        name: "Webhook",
        nodeType: "WEBHOOK_TRIGGER",
        positionX: 0,
        positionY: 0,
        variableName: "trigger",
      })
      expect(res.body.webhookKey).toEqual(expect.stringMatching(/^[a-f0-9-]{36}$/))
    })
  })
  describe("異常系", () => {
    it("他人の workflow には 404", async () => { /** ... */ })
    it("不正な nodeType で 400", async () => { /** ... */ })
  })
})
```
