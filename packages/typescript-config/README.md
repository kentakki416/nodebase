# @repo/typescript-config

モノレポ全体で共通利用する **TypeScript の base 設定 (`tsconfig.json`)** を提供する。**全 apps / packages の `tsconfig.json` は `extends` で本パッケージを参照する**。

## 役割

- 全 apps / packages で **同じ TS コンパイラ設定** を強制（`strict: true` / `target` / `module` 等）
- 各 app / package は base を extend した上で必要な差分（`outDir` / `include` 等）のみ宣言

## 公開 API

```jsonc
// apps/<app>/tsconfig.json または packages/<pkg>/tsconfig.json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

| Export | 内容 |
| --- | --- |
| `@repo/typescript-config/base.json` | 全 apps / packages 共通の base 設定 |

## 主な設定（base.json）

| key | 値 | 理由 |
| --- | --- | --- |
| `target` | `ES2020` | Node 18+ / モダンブラウザ対応 |
| `module` | `node16` | ESM / CJS interop を Node の解決ルールで処理 |
| `moduleResolution` | `node16` | `module` と揃える |
| `strict` | `true` | 全 app で strict mode 必須 |
| `esModuleInterop` | `true` | CJS パッケージの default import を許可 |
| `skipLibCheck` | `true` | 依存ライブラリの型エラーを無視（ビルド速度向上） |
| `declaration` / `declarationMap` / `sourceMap` | `true` | packages の型配布とデバッグに必須 |
| `forceConsistentCasingInFileNames` | `true` | OS 差異によるファイル名のケース差をエラー化 |
| `resolveJsonModule` | `true` | `import x from "./x.json"` を許可 |

## 使い方（新規 package / app 追加時）

```jsonc
// packages/<new-pkg>/tsconfig.json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

Next.js / Expo を使う app は、それぞれの framework が提供する preset を base に重ねる形になる（`apps/web/tsconfig.json` 等を参照）。

## ディレクトリ構成

```
packages/typescript-config/
├── base.json       # 共通 base 設定
└── package.json
```
