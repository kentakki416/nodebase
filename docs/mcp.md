# MCP サーバー

このプロジェクトでは [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) を使い、Claude Code に外部ツール・サービスを接続しています。設定は `.mcp.json` に記載されています。

## 目次

- [一覧](#一覧)
- [使い方](#使い方)
  - [GitHub MCP Server](#github-mcp-server)
  - [PostgreSQL MCP Server](#postgresql-mcp-server)
  - [Playwright MCP](#playwright-mcp)
  - [Draw.io MCP](#drawio-mcp)
  - [Lottie Creator MCP](#lottie-creator-mcp)
  - [Serena MCP](#serena-mcp)
  - [Notion MCP (無効 - 要セットアップ)](#notion-mcp-無効---要セットアップ)
  - [Slack MCP (無効 - 要セットアップ)](#slack-mcp-無効---要セットアップ)
- [MCP サーバーの追加方法](#mcp-サーバーの追加方法)

## 一覧

| MCP サーバー | パッケージ | 機能 |
|---|---|---|
| `context7` | [`@upstash/context7-mcp`](https://github.com/upstash/context7) | ライブラリの最新ドキュメントをリアルタイム取得。古い情報に基づくコード生成を防止 |
| `aws-knowledge-mcp-server` | [`mcp-remote`](https://github.com/awslabs/mcp/tree/main) (リモート) | AWS公式ナレッジベース。AWSサービスのベストプラクティス・設定例を参照 |
| `github` | [`@modelcontextprotocol/server-github`](https://github.com/github/github-mcp-server) | GitHub操作（Issue・PR作成、コード検索、リポジトリ管理等） |
| `playwright` | [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp) | ブラウザ操作の自動化。E2Eテスト・スクレイピング・UI確認 |
| `serena` | [`serena`](https://github.com/oraios/serena) (uvx) | 言語サーバー統合。シンボル検索・参照検索・コード操作・プロジェクトメモリ管理 |
| `postgres` | [`@modelcontextprotocol/server-postgres`](https://github.com/crystaldba/postgres-mcp) | PostgreSQLデータベースのスキーマ確認・クエリ実行。自然言語でDB分析可能 |
| `drawio` | [`@drawio/mcp`](https://github.com/jgraph/drawio-mcp) | Draw.io図の作成・編集。アーキテクチャ図やフローチャートをAIで生成 |
| `lottie-creator` | `@lottiefiles/creator-mcp` | LottieFiles Creator連携。ブラウザ上のCreatorエディタをAIから操作してアニメーション作成・編集 |
| `notion` (無効) | `@notionhq/notion-mcp-server` | Notionページ・DB検索・作成・更新。ドキュメント管理をAIから操作 |
| `slack` (無効) | `@anthropic-ai/mcp-server-slack` | Slackメッセージ送受信・チャンネル操作。チーム連携をAIから実行 |

## 使い方

### GitHub MCP Server

ブラウザを開かず、Claude Code 内だけで GitHub 操作が完結します。

```
# 使用例（Claude Code に自然言語で指示）
- 「このリポジトリの Issue 一覧を見せて」
- 「PR #42 の変更内容をレビューして」
- 「新しい Issue を作成して: タイトル〇〇、本文△△」
```

**セットアップ**: 環境変数 `GITHUB_PAT` に GitHub Personal Access Token を設定してください。

### PostgreSQL MCP Server

自然言語で PostgreSQL の DB 分析ができます。ローカル開発時のデータ確認に便利です。

```
# 使用例
- 「users テーブルのスキーマを見せて」
- 「先週登録したユーザーの数を数えて」
- 「orders テーブルから売上上位10件を取得して」
- 「テーブル間のリレーションを教えて」
```

**セットアップ**: 環境変数 `POSTGRES_CONNECTION_STRING` に接続文字列を設定してください。

```bash
export POSTGRES_CONNECTION_STRING="postgresql://user:password@localhost:5432/dbname"
```

### Playwright MCP

ブラウザ操作の自動化・テスト作成に使用します。

```
# 使用例
- 「ログインフローの E2E テストコードを書いて」
- 「サイトを巡回してデザイン崩れがないかチェックして」
- 「このページのスクリーンショットを撮って」
```

### Draw.io MCP

アーキテクチャ図やフローチャートを AI で生成・編集できます。

```
# 使用例
- 「このシステムのアーキテクチャ図を draw.io で作成して」
- 「既存の図にマイクロサービス間の通信フローを追加して」
- 「ER図を draw.io 形式で生成して」
```

### Lottie Creator MCP

[LottieFiles Creator](https://creator.lottiefiles.com) エディタと AI を接続し、ブラウザ上でアニメーションを作成・編集します。

```
# 使用例
- 「アクティブシーンのサイズを教えて」
- 「背景色を青に変更して」
- 「全レイヤーの一覧を表示して」
- 「パルスするローディングスピナーを作成して」
- 「選択中のレイヤーをシーンの中央に配置して」
- 「すべてのフィルをネオンシアンに変更して」
```

**前提条件**:
1. ブラウザで [creator.lottiefiles.com](https://creator.lottiefiles.com) を開いておく
2. Creator の設定で MCP を有効にする
3. Creator のタブを開いたまま AI アシスタントを使用する

**仕組み**: WebSocket でブラウザの Creator エディタと接続し、Creator API にフルアクセスします。色・トランスフォーム・タイミングの変更、シェイプ・レイヤー・キーフレームの作成、アニメーション構造の分析などが可能です。

**参考**: [公式チュートリアル](https://lottiefiles.notion.site/lottie-creator-mcp)

### Serena MCP

言語サーバー（LSP）統合により、コード構造の分析やシンボル検索を AI から実行できます。

```
# 使用例
- 「UserService クラスの全メソッドを一覧して」
- 「この関数の参照元をすべて見せて」
- 「このインターフェースの実装クラスを探して」
```

**前提条件**: `uv` (Python パッケージマネージャー) がインストールされていること。

```bash
brew install uv
```

### Notion MCP (無効 - 要セットアップ)

Notion のページやデータベースを AI から直接操作できます。議事録の作成、タスク管理、ドキュメント検索がチャット内で完結します。

```
# 使用例
- 「Notion の〇〇データベースからタスク一覧を取得して」
- 「今日の議事録ページを作成して、参加者は△△」
- 「プロジェクト仕様書のページを検索して内容を要約して」
- 「Notion のタスクのステータスを"完了"に更新して」
```

**使用感**: Notion をブラウザで開かずに、Claude Code 内からページの検索・閲覧・作成・更新ができます。特にドキュメント参照しながらコーディングする場面で、コンテキストスイッチが不要になります。

**有効化手順**:

1. [Notion Integrations](https://www.notion.so/my-integrations) で Internal Integration を作成
2. 作成した Integration の「Internal Integration Secret」をコピー
3. 環境変数を設定:
   ```bash
   export NOTION_API_TOKEN="ntn_xxxxxxxxxxxx"
   ```
4. Notion 上で、アクセスしたいページ/データベースに Integration を接続（ページ右上「...」→「コネクト」→ 作成した Integration を選択）
5. `.mcp.json` のキー名を `_disabled_notion` → `notion` に変更
6. Claude Code を再起動

### Slack MCP (無効 - 要セットアップ)

Slack のメッセージ送受信・チャンネル操作を AI から実行できます。開発中に Slack を確認したり、通知を送ったりがチャット内で完結します。

```
# 使用例
- 「#dev チャンネルの最新メッセージを10件見せて」
- 「@田中さん に『デプロイ完了しました』と DM して」
- 「#general チャンネルに今日のリリースノートを投稿して」
- 「昨日の #incident チャンネルの議論を要約して」
```

**使用感**: Slack アプリを切り替えずに、開発フロー内でチームとのコミュニケーションが可能になります。「このバグについて Slack で何か報告あった？」→ 検索 → 要約、のような流れが1ステップで完了します。

**有効化手順**:

1. [Slack API](https://api.slack.com/apps) で新しい App を作成
2. 「OAuth & Permissions」で以下の Bot Token Scopes を追加:
   - `channels:history` - パブリックチャンネルのメッセージ読取
   - `channels:read` - チャンネル一覧取得
   - `chat:write` - メッセージ送信
   - `groups:history` - プライベートチャンネルのメッセージ読取
   - `groups:read` - プライベートチャンネル一覧
   - `im:history` - DM読取
   - `im:write` - DM送信
   - `users:read` - ユーザー情報取得
3. App をワークスペースにインストールし、Bot User OAuth Token を取得
4. 環境変数を設定:
   ```bash
   export SLACK_BOT_TOKEN="xoxb-xxxxxxxxxxxx"
   export SLACK_TEAM_ID="T0XXXXXXXXX"  # ワークスペースのチームID
   ```
5. `.mcp.json` のキー名を `_disabled_slack` → `slack` に変更
6. Claude Code を再起動

> **注意**: Slack MCP でメッセージを送信する場合、Claude Code が確認プロンプトを表示します（外部への送信アクションのため）。意図しない送信を防ぐ安全機構です。

## MCP サーバーの追加方法

`.mcp.json` に新しいエントリを追加:

```json
{
  "mcpServers": {
    "new-server": {
      "command": "npx",
      "args": ["-y", "@package/mcp-server@latest"],
      "env": {
        "API_KEY": "${env:MY_API_KEY}"
      }
    }
  }
}
```

- `command`: 実行コマンド（`npx`, `uvx`, `docker` 等）
- `args`: コマンド引数
- `env`: 環境変数。`${env:VAR_NAME}` でシステム環境変数を参照可能
- 追加後、Claude Code を再起動すると利用可能になる
