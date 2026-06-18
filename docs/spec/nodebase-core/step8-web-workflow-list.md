# step8-web-workflow-list: Workflow / Credential / Execution 一覧ページ

`apps/web` に CRUD 系の一覧ページを実装する。エディタ本体（React Flow）は step9 に切り出し、ここでは「一覧表示・新規作成・削除・active 切り替え」までを対象。

## 対応内容

### 1. ページ構成

```
apps/web/src/app/
├── (dashboard)/
│   ├── layout.tsx                         # サイドバー（Workflows / Credentials / Executions）
│   ├── workflows/
│   │   ├── page.tsx                       # ワークフロー一覧 → /workflows/:id へ遷移
│   │   └── [workflowId]/page.tsx          # エディタ（step9）
│   ├── credentials/
│   │   └── page.tsx                       # Credential 一覧 + 追加ダイアログ + 削除
│   └── executions/
│       ├── page.tsx                       # 実行履歴一覧（pagination）
│       └── [executionId]/page.tsx         # 実行詳細（status / error / output JSON）
```

### 2. API クライアント

`apps/web/src/libs/api-client.ts`（既存があれば追記）:

```typescript
import ky from "ky"

const baseClient = ky.create({
  credentials: "include",  /** JWT cookie を送る */
  prefixUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  retry: 0,
})

export const apiClient = {
  credentials: {
    create: (input: { name: string, type: string, value: string }) =>
      baseClient.post("api/credentials", { json: input }).json(),
    delete: (id: string) =>
      baseClient.delete(`api/credentials/${id}`).json(),
    list: () => baseClient.get("api/credentials").json(),
  },
  executions: {
    detail: (id: string) => baseClient.get(`api/executions/${id}`).json(),
    list: (page: number, pageSize: number) =>
      baseClient.get("api/executions", { searchParams: { page, pageSize } }).json(),
  },
  workflows: {
    create: (name: string) =>
      baseClient.post("api/workflows", { json: { name } }).json(),
    delete: (id: string) => baseClient.delete(`api/workflows/${id}`).json(),
    list: () => baseClient.get("api/workflows").json(),
    update: (id: string, input: { name?: string, active?: boolean }) =>
      baseClient.patch(`api/workflows/${id}`, { json: input }).json(),
  },
}
```

戻り値型は `@repo/api-schema` の `*.infer` を当てて型付け（記述省略）。

### 3. React Query Provider のセットアップ

`apps/web/src/app/providers.tsx`（既存があれば再利用）:

```typescript
"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```

### 4. Workflow 一覧ページ

`apps/web/src/app/(dashboard)/workflows/page.tsx`:

```typescript
"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"

import { apiClient } from "../../../libs/api-client"

export default function WorkflowsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const { data, isLoading } = useQuery({
    queryFn: () => apiClient.workflows.list(),
    queryKey: ["workflows"],
  })
  const createMutation = useMutation({
    mutationFn: (n: string) => apiClient.workflows.create(n),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.workflows.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  })
  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string, active: boolean }) =>
      apiClient.workflows.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  })

  /** ... 一覧テーブル + 「New」ボタン + 各行の active toggle / delete */
}
```

### 5. UI コンポーネント

reference は shadcn/ui ベース。本プロジェクトも同じ shadcn/ui を `apps/web` に既存セットアップがあれば再利用。なければ `Button` / `Input` / `Table` / `Dialog` / `Switch` を最小限自前で実装（後から shadcn に置き換える）。

### 6. Credential 一覧ページ

`apps/web/src/app/(dashboard)/credentials/page.tsx`:

- 一覧テーブル: `name` / `type` / `maskedValue` / `createdAt`
- 「新規作成」ボタン → ダイアログで `name` / `type` (`OPENAI` 固定 select) / `value` を入力 → 保存
- 各行に「削除」ボタン
- 値の編集は不可（再作成のみ）

### 7. Execution 一覧 / 詳細ページ

#### 一覧 `/executions`

- ページネーション付きテーブル: `workflowName` / `startedAt` / `completedAt` / `status` / `triggerType`
- status バッジ: `RUNNING`（青）/ `SUCCESS`（緑）/ `FAILED`（赤）
- 行クリックで詳細へ

#### 詳細 `/executions/:executionId`

- ヘッダー: `workflowName` / `startedAt` / `completedAt` / `status`
- `FAILED` の場合: `error` を赤ボックスで表示、`failedNodeId` ハイライト
- `output` セクション: JSON Pretty 表示（`<pre>`）
- **3 秒間隔で polling**（`useQuery({ refetchInterval: status === "RUNNING" ? 3000 : false })`）

### 8. レイアウト

`apps/web/src/app/(dashboard)/layout.tsx`:

```typescript
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-60 border-r bg-zinc-50 p-4">
        <Link href="/workflows" className="block py-2">Workflows</Link>
        <Link href="/credentials" className="block py-2">Credentials</Link>
        <Link href="/executions" className="block py-2">Executions</Link>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

## 動作確認

CLAUDE.md / verify-web-page skill の方針に従い、`pnpm build` だけで OK にしない。Playwright MCP で画面を開いて確認する。

### 自動テスト（React Component）

UI コンポーネントの React Testing Library テストは MVP では作らない（変更頻度が高く、手戻りコスト > 検出価値）。代わりに **e2e（後述）** で代用。

### Playwright MCP 動作確認

```
1. docker compose up -d && pnpm dev
2. Playwright MCP で http://localhost:3000/workflows へ
3. JWT cookie を seed（dev-login skill の手順）
4. シナリオ:
   - 「新規作成」→ 「test wf」入力 → 一覧に追加されることを確認 → スクショ
   - 行をクリック → /workflows/:id へ遷移できる（エディタは step9）
   - active トグル → 状態が更新される
   - 削除 → 一覧から消える
5. /credentials へ → 「新規作成」→ OpenAI + sk-test1234 → 一覧に maskedValue (sk-t****) で表示
6. /executions へ → （step5 で実行を起こした履歴があれば）一覧表示
```

### スクリーンショット

`docs/screenshots/nodebase-core/` 配下に before/after を必ず保存し、PR 本文に貼る（CLAUDE.md / verify-web-page skill）。
