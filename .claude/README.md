# .claude ディレクトリ構成ガイド

このディレクトリには Claude Code の設定・拡張機能が配置されています。

## 目次

- [Agents（サブエージェント）](#agentsサブエージェント)
  - [使い方](#使い方)
  - [追加方法](#追加方法)
- [Commands（スラッシュコマンド）](#commandsスラッシュコマンド)
  - [使い方](#使い方-1)
  - [追加方法](#追加方法-1)
- [Skills（スキル）](#skillsスキル)
  - [使い方](#使い方-2)
  - [追加方法](#追加方法-2)
- [設定ファイル](#設定ファイル)
  - [settings.json（チーム共有）](#settingsjsonチーム共有)
  - [settings.local.json（個人用・gitignore対象）](#settingslocaljson個人用gitignore対象)
- [MCP Server](#mcp-server)

## Agents（サブエージェント）

メインのClaudeが特定タスクを委譲する専門エージェント。バックグラウンドで並列実行可能。

| エージェント | 用途 | モデル |
|---|---|---|
| `architect` | システム設計、スケーラビリティ、技術的意思決定（ADR形式で出力） | opus |
| `build-error-resolver` | ビルド/TypeScriptエラーの最小差分修正（リファクタリングはしない） | opus |
| `code-reviewer` | コード品質・セキュリティ・保守性レビュー | opus |
| `e2e-runner` | Playwright E2Eテストの生成・実行・フレーキー対策 | opus |
| `planner` | 機能実装・リファクタリングの計画作成（ステップ分解） | opus |
| `refactor-cleaner` | デッドコード検出・削除（knip / depcheck / ts-prune） | opus |
| `security-auditor` | フロント/バックエンド/インフラの包括的セキュリティ監査（リリース前など広範囲） | sonnet |
| `security-reviewer` | OWASP Top 10 観点の個別コード変更レビュー（範囲は狭く深く） | opus |
| `tdd-guide` | テスト駆動開発の強制。プロジェクトのテスト方針（`jest.fn()` 推奨・文字列assertion禁止）に従う | opus |

> 各エージェントは**プロジェクト固有の知識を本文に持たない**設計です。実装規約は `CLAUDE.md` 階層（ルート + `apps/*/CLAUDE.md` + `packages/*/CLAUDE.md`）に集約し、エージェントはファイルを読んだタイミングで自動ロードされる仕組みに依存します。これにより文書の二重管理と腐敗を防いでいます。

### 使い方

Claudeが自動的に適切なエージェントを選択して委譲します。ユーザーが直接指定する必要はありません。

- Claudeがタスクの内容に応じて `description` を参照し、最適なエージェントを起動
- 複数エージェントを並列で起動することも可能
- 結果はメインのClaudeに返され、ユーザーに要約して報告される

### 追加方法

`.claude/agents/` に Markdown ファイルを作成:

```markdown
---
name: my-agent
description: エージェントの説明（いつ使うべきかを含める）
tools: Read, Write, Edit, Bash, Grep, Glob
model: opus
---

# エージェント名

## 役割
このエージェントが何を担当するかの説明

## 実行手順
1. ステップ1
2. ステップ2
3. ステップ3

## 制約
- 制約1
- 制約2
```

**frontmatter のフィールド:**

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | エージェント識別名 |
| `description` | Yes | 説明文。Claudeがどのエージェントを使うか判断する材料になる。「〇〇時に積極的に使用してください」と書くと自動起動の対象になる |
| `tools` | Yes | 使用可能なツール（Read, Write, Edit, Bash, Grep, Glob等） |
| `model` | No | 使用モデル（`opus`, `sonnet`, `haiku`）。省略時は親と同じ |
| `color` | No | 表示色（`red`, `blue` 等） |

---

## Commands（スラッシュコマンド）

ユーザーがチャットで `/コマンド名` と入力して実行する定型プロンプト。

| コマンド | 説明 |
|---|---|
| `/code-review` | コミット前のセキュリティ・品質レビュー。ハードコードされた認証情報、SQLi、XSS等をチェック |
| `/learn` | セッション中に解決したパターンをスキルファイルとして抽出・保存 |
| `/plan` | 実装前に要件再確認・リスク評価・ステップ計画を作成。確認後に実装開始 |
| `/serena` | Serena MCPを使ったトークン効率の良い構造化開発。debug/design/review/implementモード対応 |

### 使い方

チャット入力欄で `/コマンド名` と入力するだけで実行されます。引数も渡せます。

```
/plan 認証機能を追加したい
/serena implement "ユーザー管理API"
/code-review
/learn
```

- コマンドのMarkdown内容がそのままClaudeへのプロンプトとして展開される
- 引数はプロンプトの末尾に追加される
- `allowed-tools` でそのコマンド実行中に使えるツールを制限可能

### 追加方法

`.claude/commands/` に Markdown ファイルを作成。**ファイル名がそのままコマンド名**になる:

```markdown
---
description: コマンドの説明（省略可）
allowed-tools: Read, Bash, Grep
---

# コマンド名

実行する手順を自然言語で記述。
Claudeはこのプロンプトに従って処理を実行します。

1. まず〇〇を確認
2. 次に〇〇を実行
3. 結果を報告
```

**例: `deploy-check.md` → `/deploy-check` で呼び出し可能**

**frontmatter のフィールド:**

| フィールド | 必須 | 説明 |
|---|---|---|
| `description` | No | コマンドの説明（UIに表示される） |
| `allowed-tools` | No | 使用可能ツールのカンマ区切りリスト。MCP ツールも指定可能（例: `mcp__serena__find_symbol`） |

**本文の書き方:**
- 自然言語で手順を記述する（Claudeへの指示書）
- チェックリスト形式、ステップ形式、自由文いずれもOK
- 具体的であるほどClaudeの実行精度が上がる

---

## Skills（スキル）

Claudeが参照するドメイン知識・パターン集。タスクに関連するスキルが自動的にロードされます。

| スキル | 説明 |
|---|---|
| `design-feature` | 新機能の設計書（`docs/spec/{feature}/` 配下の人間用 README + AI実装用 step ファイル）を作成し、`docs/spec/README.md`（全機能のクイックリファレンス）も更新する。**実装前に必ず通すこと**。「〜の設計を作って」「〜機能を追加したい」で起動 |
| `design-mock` | デザインモックを `apps/web` に作成し、ユーザー承認後に `docs/spec/{feature}/README.md` の「UI設計」セクションを追記する。テーマヒアリング → `apps/admin` の既存デザイン参照 → モック作成 → 承認 → 仕様書化 までを 1 skill で対応。「モック作って」「画面のイメージを作って」で起動 |

> プロジェクト固有のコーディング規約・アーキテクチャは `CLAUDE.md` と各サブディレクトリ（`apps/*/CLAUDE.md`、`packages/*/CLAUDE.md`）に集約されています。skill には**タスク手順型のもの**だけを置きます。

### 使い方

**ユーザーが明示的に呼び出す必要はありません。** Claudeが現在のタスクに関連するスキルを `description` から判断し、自動的にロードします。

- 新機能の設計を依頼された → `design-feature` がロードされる
- モック作成を依頼された → `design-mock` がロードされる

スキルはCommandsやAgentsとは異なり、**知識ベース**（参照資料）として機能します。処理を実行するのではなく、Claudeの判断に影響を与えます。

### 追加方法

`.claude/skills/{skill-name}/SKILL.md` を作成（ディレクトリ構造が必須）:

```
.claude/skills/
└── my-skill/
    ├── SKILL.md           # メインのスキル定義（必須）
    └── references/        # 補助資料（任意）
        ├── patterns.md
        └── examples.md
```

**SKILL.md のテンプレート:**

```markdown
---
name: my-skill
description: スキルの説明（いつロードするかの判断に使われる。具体的に書く）
---

# スキル名

## 概要
このスキルが提供する知識の説明

## パターン/ルール

### パターン1: 〇〇の場合
説明とコード例

### パターン2: 〇〇のベストプラクティス
推奨パターンの説明

## アンチパターン
やってはいけないことの列挙
```

**frontmatter のフィールド:**

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | スキル識別名 |
| `description` | Yes | 説明文。Claudeがロードすべきか判断する材料。具体的なキーワード（「認証」「API設計」「React」等）を含めると精度が上がる |

**ポイント:**
- `description` が最重要。ここに書かれたキーワードとタスクの関連性でロード判断される
- `references/` にコード例や詳細資料を分離すると、SKILL.md を簡潔に保てる
- スキルは「読み取り専用の知識」。処理を実行させたい場合はCommandやAgentを使う

---

## 設定ファイル

### settings.json（チーム共有）

hooks設定を定義。現在は以下のイベントで通知音を鳴らす:
- `PermissionRequest`: 権限リクエスト時
- `Stop`: 処理完了時

### settings.local.json（個人用・gitignore対象）

ローカルの権限許可リスト。頻繁に使うコマンドの自動承認設定。

---

## MCP Server

MCP の設定・一覧はルートの [README.md](../README.md#mcp-サーバー) を参照。

Commands の `allowed-tools` で MCP ツールを許可すると、特定コマンド内でのみ使用できる:

```
allowed-tools: mcp__serena__find_symbol, mcp__context7__get-library-docs
```

ツール名の形式: `mcp__{server-name}__{tool-name}`