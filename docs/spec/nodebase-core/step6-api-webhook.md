# step6-api-webhook: Webhook 受信エンドポイント

外部サービスから Webhook を受け取り、対応する Workflow を実行起動する。**認証なし・公開 URL**。`webhookKey` で WorkflowNode を特定する。

## 対応内容

### 1. Repository に「webhookKey で逆引き」を追加

`PrismaWorkflowNodeRepository`:

```typescript
public async findActiveByWebhookKey(webhookKey: string): Promise<{
  nodeId: string,
  workflowId: string,
  userId: number,
} | null> {
  const node = await this._prisma.workflowNode.findFirst({
    select: {
      id: true,
      workflow: { select: { active: true, id: true, userId: true } },
    },
    where: { webhookKey, workflow: { active: true } },
  })
  if (!node) return null
  return {
    nodeId: node.id,
    userId: node.workflow.userId,
    workflowId: node.workflow.id,
  }
}
```

`active: false` の Workflow は **存在しないものとして扱う**（外部に存在を知らせない）。

### 2. Service

`apps/api/src/service/webhook-service.ts`:

```typescript
export type WebhookPayload = {
  body: unknown
  headers: Record<string, string>
  method: string
  query: Record<string, string>
}

export const triggerWorkflowFromWebhook = async (
  webhookKey: string, payload: WebhookPayload,
  repo: {
    workflowNodeRepository: WorkflowNodeRepository
    executionRepository: ExecutionRepository
  },
  deps: { queue: JobQueue<WorkflowExecutionJob> }
): Promise<Result<{ executionId: string }>> => {
  const target = await repo.workflowNodeRepository.findActiveByWebhookKey(webhookKey)
  if (!target) return err(notFoundError("Webhook not found"))

  /** initialContext は Execution payload には埋め込まず、Worker 側で再構築するか
   *  Execution の output 初期値として保存。MVP では Execution.output に
   *  { __webhook: payload } として記録し、Worker がそれを初期 context に使う */
  const execution = await repo.executionRepository.createWithInitialContext({
    initialContext: { __webhook: payload },
    triggerType: "WEBHOOK",
    userId: target.userId,
    workflowId: target.workflowId,
  })

  await deps.queue.add(WORKFLOW_EXECUTION_QUEUE_NAME, { executionId: execution.id })
  return ok({ executionId: execution.id })
}
```

**設計判断**: Webhook の initial context は Execution.output に「初期値」として埋め込む。Worker は Execution を取得した時に `output.__webhook` があれば、それを Webhook Trigger ノードの出力として `context[variableName] = payload` に展開する。

`ExecutionRepository.createWithInitialContext` を新設:

```typescript
public async createWithInitialContext(input: CreateExecutionInput & { initialContext: Record<string, unknown> }): Promise<Execution> {
  const row = await this._prisma.execution.create({
    data: {
      output: input.initialContext,  /** 初期値として埋め込む */
      status: "RUNNING",
      triggerType: input.triggerType,
      userId: input.userId,
      workflowId: input.workflowId,
    },
  })
  return this._toDomain(row)
}
```

### 3. Controller

`apps/api/src/controller/webhook/receive.ts`:

```typescript
export class WebhookReceiveController {
  constructor(
    private readonly _workflowNodeRepository: WorkflowNodeRepository,
    private readonly _executionRepository: ExecutionRepository,
    private readonly _queue: JobQueue<WorkflowExecutionJob>,
  ) {}

  public async execute(req: Request, res: Response) {
    const { webhookKey } = req.params

    const payload: WebhookPayload = {
      body: req.body,
      headers: this._normalizeHeaders(req.headers),
      method: req.method,
      query: this._normalizeQuery(req.query),
    }

    const result = await service.webhook.triggerWorkflowFromWebhook(
      webhookKey, payload,
      { executionRepository: this._executionRepository, workflowNodeRepository: this._workflowNodeRepository },
      { queue: this._queue },
    )
    if (!result.ok) return sendError(req, res, result.error)
    return res.status(202).json({ executionId: result.value.executionId })
  }

  private _normalizeHeaders(headers: Request["headers"]): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) {
      if (typeof v === "string") out[k.toLowerCase()] = v
      else if (Array.isArray(v)) out[k.toLowerCase()] = v.join(",")
    }
    return out
  }

  private _normalizeQuery(query: Request["query"]): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(query)) {
      if (typeof v === "string") out[k] = v
      else if (Array.isArray(v)) out[k] = v.join(",")
    }
    return out
  }
}
```

### 4. Router

`apps/api/src/routes/webhook-router.ts`:

```typescript
export const webhookRouter = (c: { receive?: WebhookReceiveController }): Router => {
  const r = Router()
  if (c.receive) {
    r.get("/:webhookKey", (req, res) => c.receive!.execute(req, res))
    r.post("/:webhookKey", (req, res) => c.receive!.execute(req, res))
    r.put("/:webhookKey", (req, res) => c.receive!.execute(req, res))
  }
  return r
}
```

### 5. `PUBLIC_PATHS` への追加

`apps/api/src/middleware/auth.ts` の認証スキップパスに `/api/webhooks` を追加:

```typescript
const PUBLIC_PATHS = [
  /^\/api\/health/,
  /^\/api\/auth\//,
  /^\/api\/webhooks\//,  /** ← 追加 */
]
```

### 6. body-parser 上限

`apps/api/src/index.ts`:

```typescript
app.use("/api/webhooks", express.json({ limit: "256kb" }))
app.use("/api/webhooks", express.urlencoded({ extended: true, limit: "256kb" }))
```

他の `/api/*` よりも先に webhook 用の body-parser を登録する（form 形式の webhook を受けるため）。

## 動作確認

### Service ユニットテスト

```typescript
describe("triggerWorkflowFromWebhook", () => {
  describe("正常系", () => {
    it("有効な webhookKey で Execution を作り Queue に enqueue する", async () => { /** ... */ })
    it("initialContext.__webhook にペイロードが入る", async () => { /** ... */ })
  })
  describe("異常系", () => {
    it("無効な webhookKey で NOT_FOUND", async () => { /** ... */ })
    it("workflow.active=false で NOT_FOUND（外部にアクティブ性を知らせない）", async () => { /** ... */ })
  })
})
```

### Controller integration

```typescript
describe("POST /api/webhooks/:webhookKey", () => {
  describe("正常系", () => {
    it("202 で executionId を返し、認証なしでも通る", async () => {
      /** workflow と Webhook Trigger ノードを seed */
      const node = await testPrisma.workflowNode.create({ data: {
        data: {},
        name: "wh",
        nodeType: "WEBHOOK_TRIGGER",
        positionX: 0,
        positionY: 0,
        variableName: "trigger",
        webhookKey: "test-key-123",
        workflowId,
      } })
      await testPrisma.workflow.update({ data: { active: true }, where: { id: workflowId } })

      const res = await request(app)
        .post("/api/webhooks/test-key-123")
        .send({ payload: "hello" })  /** Cookie 無し */
      expect(res.status).toBe(202)
      expect(res.body).toEqual({ executionId: expect.any(String) })

      const exec = await testPrisma.execution.findUnique({ where: { id: res.body.executionId } })
      expect((exec?.output as any).__webhook.body).toEqual({ payload: "hello" })
    })
  })
  describe("異常系", () => {
    it("workflow.active=false で 404", async () => { /** ... */ })
    it("無効な webhookKey で 404", async () => { /** ... */ })
  })
})
```
