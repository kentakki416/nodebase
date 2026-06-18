# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## アーキテクチャ

### ディレクトリ構成

```
src/
  app/                        # ルーティング + ページ構成（薄く保つ）
  components/
    ui/                       # 汎用UIコンポーネント（Button, Input等）
    layout/                   # レイアウト系（Header, Sidebar等）
    features/                 # 機能固有のUIコンポーネント
      {feature}/              #   例: memo/MemoForm.tsx, memo/MemoListItem.tsx
  features/                   # ロジックのみ（レンダリングなし）
    {feature}/
      {feature}.api.ts        #   API通信
      {feature}.entity.ts     #   型・エンティティ
      {feature}.state.ts      #   状態管理（zustand）
  hooks/                      # 共有カスタムフック
  constants/                  # 定数
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
| **状態管理はfeatures内** | zustandのstoreは各featureに配置。グローバルなContextには出さない |

### コンポーネントの分類基準

| 層 | 配置するもの | 依存ルール |
|---|---|---|
| **ui/** | propsだけで動く汎用パーツ。ビジネスロジックを持たない | 他の層に依存しない |
| **features/** | 特定のドメイン・機能に紐づくコンポーネント | `ui/`と`layout/`を使ってよい |
| **layout/** | 画面の構造やナビゲーションを決めるコンポーネント | `ui/`を使ってよい |

**判断基準:** ドメイン知識なしで動く → `ui/` / レイアウト系 → `layout/` / それ以外 → `features/{domain}/`

## EAS によるビルド・公開

[EAS (Expo Application Services)](https://docs.expo.dev/eas/) を使ってアプリをビルド・公開できます。

### セットアップ

```bash
# EAS CLI をグローバルにインストール
npm install -g eas-cli

# Expo アカウントにログイン
eas login

# プロジェクトを Expo に紐付け（初回のみ）
eas init
```

### ビルドプロファイル

`eas.json` に3つのプロファイルが定義されています。

| プロファイル | 用途 | 配布方法 |
|---|---|---|
| `development` | 開発ビルド（dev client） | 内部配布 |
| `preview` | テスト・レビュー用ビルド | 内部配布 |
| `production` | ストア公開用ビルド | ストア |

### ビルド

```bash
# 開発ビルド（iOS + Android）
pnpm eas:build:dev

# プレビュービルド（iOS + Android）
pnpm eas:build:preview

# 本番ビルド（iOS + Android）
pnpm eas:build:prod

# プラットフォーム別ビルド
pnpm eas:build:ios
pnpm eas:build:android
```

### ストアへの提出

```bash
# iOS（App Store Connect）
pnpm eas:submit:ios

# Android（Google Play Console）
pnpm eas:submit:android
```

提出前に `eas.json` の `submit.production` セクションを設定してください。

- **iOS**: `appleId`, `ascAppId`, `appleTeamId` を設定
- **Android**: `serviceAccountKeyPath` に Google Play サービスアカウントキーのパスを設定

### OTA アップデート (EAS Update)

JavaScript バンドルのみの変更であれば、ストアを経由せずにアップデートを配信できます。

```bash
pnpm eas:update
```

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
