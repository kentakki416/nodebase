# @repo/eslint-config

モノレポ全体で共通利用する ESLint v9 (flat config) のルール群を提供する。**全 apps / packages の `eslint.config.js` は本パッケージを参照する**。

## 役割

- 全 apps / packages で **同じ lint ルール** を強制（命名規則 / import 順 / クォート / セミコロン等）
- `common-rules` のみを export し、apps 側は自身の framework (Next / Expo / Express) 用 config に merge する形で利用

## 公開 API

```js
// eslint.config.js（apps / packages 側）
import commonRules from "@repo/eslint-config/common-rules"

export default [
  // ...
  commonRules,
]
```

| Export | 内容 |
| --- | --- |
| `@repo/eslint-config/common-rules` | 全 apps / packages 共通の rule set（命名・import 順・style 等） |
| `@repo/eslint-config` (= `index.js`) | 内部互換用エントリ。新規 app では `common-rules` を直接参照すること |

## 主なルール

ルートの [CLAUDE.md](../../CLAUDE.md) の「Code Style and Linting」セクションが正本。要約：

- **No semicolons** / **Double quotes** / **Object curly spacing `{ foo }`**
- **Strict equality (`===`)** / **Sort object keys alphabetically**（id 先頭、timestamps 末尾）
- **Import ordering**: builtin → external → internal (`@repo`) → parent → sibling → index、グループ間に空行
- **`@typescript-eslint/explicit-member-accessibility`**: クラスメンバーは `public` / `private` 明示
- **private メンバーは `_` プレフィックス必須**（constructor parameter property を含む）
- **No `any`** (warn) / **`async` for Promise-returning functions**

## 使い方（新規 app 追加時）

```js
// apps/<new-app>/eslint.config.js
import commonRules from "@repo/eslint-config/common-rules"

export default [
  // Next.js / Expo を使う場合はその config を先に置く
  commonRules,
]
```

> **注意**: `eslint-config-next` / `eslint-config-expo` を使う app は **`@typescript-eslint` プラグインを再定義してはいけない**（"Cannot redefine plugin" エラー）。`common-rules` は再定義を避けた形になっている。

## ディレクトリ構成

```
packages/eslint-config/
├── index.js          # 互換エントリ
├── common-rules.js   # 共通ルール本体
└── package.json
```

## 関連

- ルートの [CLAUDE.md](../../CLAUDE.md) — Code Style 全体の正本
- 各 app の `eslint.config.js` — このパッケージの使用例
