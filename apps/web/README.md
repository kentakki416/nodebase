# Web Application

Next.js 16 (App Router) を使用した Web アプリケーション

## アーキテクチャ

### ディレクトリ構成

```
src/
  app/                        # ルーティング + ページ構成（薄く保つ）
    (auth)/                   # Route Group（認証関連）
    dashboard/                # ダッシュボード
    api/                      # API Route Handlers（Webhook等）
  components/
    ui/                       # 汎用UIコンポーネント（Button, Input等）
    layout/                   # レイアウト系（Header, Footer等）
    features/                 # 機能固有のUIコンポーネント
      {feature}/              #   例: auth/LoginForm.tsx
  features/                   # ロジックのみ（レンダリングなし）
    {feature}/
      {feature}.api.ts        #   API通信
      {feature}.entity.ts     #   型・エンティティ
      {feature}.state.ts      #   状態管理
  hooks/                      # 共有カスタムフック
  libs/                       # ユーティリティ（APIクライアント等）
  constants/                  # 定数
  middleware.ts               # ミドルウェア（認証チェック等）
```

### 依存の方向

```
app/ → components/ → features/(ロジック)
                   → hooks/
                   → constants/
```

上位から下位への一方向のみ。`features/`（ロジック）はUIに依存しない。

### API型の利用ルール

- APIのリクエスト・レスポンスの型は、ローカルで独自定義せず `@repo/api-schema` からインポートして使用する
- `@repo/api-schema` には Zod スキーマと推論された TypeScript 型がエクスポートされているため、バリデーションと型安全性の両方が得られる
- これにより API とフロントエンドの型が常に一致し、型の不整合によるバグを防げる

```typescript
// OK: @repo/api-schema から型をインポート
import { GetUserResponse } from "@repo/api-schema"
type User = GetUserResponse

// NG: ローカルで独自に型を定義
type User = {
  id: number
  email: string | null
  name: string | null
}
```

### 設計原則

| 原則 | 内容 |
|---|---|
| **ルートファイルは薄く** | `app/`にはビジネスロジックを書かず、コンポーネントの組み合わせのみ |
| **features/ = ロジック層** | API通信・状態管理・型定義を機能単位で凝集。レンダリングは持たない |
| **components/ = UI層** | 見た目を担当。`features/`のロジックはprops経由で受け取る |
| **状態管理はfeatures内** | stateは各featureに配置 |

### コンポーネントの分類基準

| 層 | 配置するもの | 依存ルール |
|---|---|---|
| **ui/** | propsだけで動く汎用パーツ。ビジネスロジックを持たない | 他の層に依存しない |
| **features/** | 特定のドメイン・機能に紐づくコンポーネント | `ui/`と`layout/`を使ってよい |
| **layout/** | ページの構造やレイアウトを決めるコンポーネント | `ui/`を使ってよい |

**判断基準:** ドメイン知識なしで動く → `ui/` / レイアウト系 → `layout/` / それ以外 → `features/{domain}/`

### API 通信方式

ブラウザから Express API を直接 fetch しない。Next.js の Server Components / Server Actions / Route Handlers を経由してサーバー間通信する。

#### データ取得（GET）

| 用途 | 方式 | 例 |
|------|------|----|
| ページの初期データ表示 | Server Component で `apiClient.get()` | ダッシュボード、一覧表示 |
| Client Component からの動的データ取得 | Route Handler (`app/api/*/route.ts`) | タブ切替、検索、フィルタ変更 |

#### データ変更（POST/PUT/DELETE）

| 用途 | 方式 | 例 |
|------|------|----|
| フォーム送信・ボタンによる CRUD | Server Action (`"use server"`) | 作成・更新・削除 |
| Server Action が適さない場合 | Route Handler | ファイルアップロード、Webhook受信 |

---

## 開発コマンド

```bash
# 開発サーバー起動（ホットリロード）
pnpm dev

# ビルド
pnpm build

# 本番サーバー起動
pnpm start

# リント
pnpm lint
pnpm lint:fix
```
