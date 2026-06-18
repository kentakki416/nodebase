# step9-web-editor: React Flow ベースのワークフローエディタ

`apps/web/src/app/(dashboard)/workflows/[workflowId]/page.tsx` に、React Flow を使ったキャンバスを実装する。reference と同じ `@xyflow/react` を使う。

## 対応内容

### 1. 依存追加

```bash
pnpm --filter web add @xyflow/react react-hook-form @hookform/resolvers zod
```

### 2. ファイル構成

```
apps/web/src/
├── app/(dashboard)/workflows/[workflowId]/page.tsx   # エディタページ
├── features/workflow-editor/
│   ├── editor.tsx                                    # React Flow キャンバス本体
│   ├── editor-header.tsx                             # 名前 / active / 実行ボタン
│   ├── node-types.ts                                 # nodeType -> React Flow ノードコンポーネント
│   ├── components/
│   │   ├── manual-trigger-node.tsx
│   │   ├── webhook-trigger-node.tsx
│   │   ├── http-request-node.tsx
│   │   └── openai-node.tsx
│   ├── dialogs/
│   │   ├── http-request-dialog.tsx                   # 設定ダイアログ（URL / method / body）
│   │   ├── openai-dialog.tsx                         # 設定ダイアログ（model / prompt / credential）
│   │   └── webhook-trigger-dialog.tsx                # 設定ダイアログ（method、URL コピー）
│   ├── node-picker.tsx                               # 「ノード追加」メニュー
│   └── hooks/
│       └── use-workflow-mutations.ts                 # node/edge の add/patch/delete API 呼び出し
```

### 3. Editor 本体

```typescript
"use client"
import { ReactFlow, type Node, type Edge, addEdge, applyNodeChanges, applyEdgeChanges,
  Background, Controls, MiniMap } from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { useState } from "react"

import { nodeTypes } from "./node-types"
import { useWorkflowMutations } from "./hooks/use-workflow-mutations"

type Props = { workflowId: string, initialNodes: Node[], initialEdges: Edge[] }

export function Editor({ workflowId, initialNodes, initialEdges }: Props) {
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const m = useWorkflowMutations(workflowId)

  return (
    <ReactFlow
      edges={edges}
      fitView
      nodes={nodes}
      nodeTypes={nodeTypes}
      onConnect={async (conn) => {
        /** API: POST /api/workflows/:id/edges */
        const edge = await m.addEdge({ fromNodeId: conn.source!, toNodeId: conn.target! })
        setEdges((e) => addEdge({ id: edge.id, source: edge.fromNodeId, target: edge.toNodeId }, e))
      }}
      onEdgesChange={(changes) => {
        setEdges((e) => applyEdgeChanges(changes, e))
        for (const c of changes) if (c.type === "remove") m.deleteEdge(c.id)
      }}
      onNodesChange={(changes) => {
        setNodes((n) => applyNodeChanges(changes, n))
        /** position 変化は debounce して PATCH（移動中に毎回投げない） */
        for (const c of changes) {
          if (c.type === "position" && c.dragging === false) {
            m.updateNodePosition(c.id, c.position!)
          }
          if (c.type === "remove") m.deleteNode(c.id)
        }
      }}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  )
}
```

### 4. ノードコンポーネント

`apps/web/src/features/workflow-editor/node-types.ts`:

```typescript
import type { NodeTypes } from "@xyflow/react"
import { ManualTriggerNode } from "./components/manual-trigger-node"
import { WebhookTriggerNode } from "./components/webhook-trigger-node"
import { HttpRequestNode } from "./components/http-request-node"
import { OpenAiNode } from "./components/openai-node"

export const nodeTypes: NodeTypes = {
  HTTP_REQUEST: HttpRequestNode,
  MANUAL_TRIGGER: ManualTriggerNode,
  OPENAI: OpenAiNode,
  WEBHOOK_TRIGGER: WebhookTriggerNode,
}
```

各ノード（例: `HttpRequestNode`）は:

```typescript
"use client"
import { Handle, Position } from "@xyflow/react"
import { useState } from "react"

import { HttpRequestDialog } from "../dialogs/http-request-dialog"

export function HttpRequestNode({ id, data }: { id: string, data: any }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Handle position={Position.Left} type="target" />
      <div className="rounded border bg-white p-3 shadow-sm cursor-pointer" onClick={() => setOpen(true)}>
        <div className="text-xs text-zinc-500">HTTP Request</div>
        <div className="font-semibold">{data.name || "Untitled"}</div>
        <div className="mt-1 truncate text-xs text-zinc-400">{data.method ?? "GET"} {data.url ?? "(no url)"}</div>
      </div>
      <Handle position={Position.Right} type="source" />
      {open && <HttpRequestDialog nodeId={id} initial={data} onClose={() => setOpen(false)} />}
    </>
  )
}
```

トリガーノード（Manual / Webhook）は `target Handle` を持たない（最初のノードなので）。

### 5. ダイアログでの設定編集

例: `HttpRequestDialog`:

```typescript
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { apiClient } from "../../../libs/api-client"

const schema = z.object({
  body: z.string().optional(),
  headers: z.string().optional(),  /** JSON 文字列 */
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  name: z.string().min(1),
  url: z.string().min(1),
  variableName: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
})

export function HttpRequestDialog({ nodeId, initial, onClose }: Props) {
  const form = useForm({ defaultValues: initial, resolver: zodResolver(schema) })
  const onSubmit = form.handleSubmit(async (values) => {
    await apiClient.workflows.updateNode(nodeId, {
      data: { body: values.body, headers: values.headers, method: values.method, url: values.url },
      name: values.name,
      variableName: values.variableName,
    })
    onClose()
  })
  /** ... form 表示。url / body / headers / system prompt フィールドは
   *  「前ノード変数」を {{...}} 構文で参照可能なことを placeholder で示す */
}
```

### 6. ノード追加メニュー

`NodePicker`（右上にボタン → メニュー）:

```typescript
const NODE_TEMPLATES = [
  { defaultData: {}, label: "Manual Trigger", nodeType: "MANUAL_TRIGGER" },
  { defaultData: { method: "POST" }, label: "Webhook Trigger", nodeType: "WEBHOOK_TRIGGER" },
  { defaultData: { method: "GET", url: "" }, label: "HTTP Request", nodeType: "HTTP_REQUEST" },
  { defaultData: { model: "gpt-4o-mini", systemPrompt: "", userPrompt: "" }, label: "OpenAI", nodeType: "OPENAI" },
]

function NodePicker({ workflowId, onAdd }: Props) {
  return <div>
    {NODE_TEMPLATES.map((t) => (
      <button key={t.nodeType} onClick={() => onAdd(t)}>{t.label}</button>
    ))}
  </div>
}
```

`onAdd` → `POST /api/workflows/:id/nodes` → 新規ノードをキャンバスの中央に配置。

### 7. Editor ヘッダー

`apps/web/src/features/workflow-editor/editor-header.tsx`:

- 左: ワークフロー名（クリックで rename inline）
- 中央: active トグル
- 右: 「実行」ボタン → `POST /api/workflows/:id/execute` → 完了後に `/executions/:executionId` へ遷移

### 8. 初期データ取得

ページ（`page.tsx`）は Server Component で `apiClient.workflows.detail(workflowId)` を呼んで初期 nodes/edges を取得 → クライアント側 `<Editor />` に props で渡す。

## 動作確認

### Playwright MCP シナリオ

```
1. /workflows から既存ワークフローをクリック → エディタ表示
2. 「ノード追加」→ Manual Trigger → キャンバスに追加される（API レスポンス確認）
3. 「ノード追加」→ HTTP Request → 追加
4. Manual Trigger の右ハンドルを HTTP Request の左ハンドルにドラッグ → edge が引かれ、API 呼び出し成功
5. HTTP Request ノードをクリック → ダイアログが開く → URL に "https://httpbin.org/get" を入力 → 保存
6. 「実行」ボタン → 結果ページに遷移 → polling で SUCCESS 表示 → output.httpRequest.body に httpbin の response が入っている
7. 履歴ページに 1 件追加されている
```

各ステップで before/after スクショを `docs/screenshots/nodebase-core/editor/` に保存。

### 既知の落とし穴

- React Flow のスタイル（`@xyflow/react/dist/style.css`）の import を忘れない
- Server Component 内で React Flow を使うとビルドが落ちるので、エディタは必ず `"use client"`
- `position` の変更を毎フレーム API に投げないよう、ドラッグ完了 (`dragging === false`) で 1 回だけ PATCH する
