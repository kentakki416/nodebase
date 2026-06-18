# nodebase

n8n クローンを目指すワークフロー自動化プラットフォーム。Turborepo + pnpm monorepo で構成。

## 目次

- [プロジェクト構成図](#プロジェクト構成図)
- [技術スタック](#技術スタック)
- [クイックリファレンス](#クイックリファレンス)
  - [セットアップ手順 (まずここから)](#セットアップ手順-まずここから)
  - [仕様 / 設計](#仕様--設計)
- [テンプレートの使い方](#テンプレートの使い方)
  - [1. プロジェクトのコピー](#1-プロジェクトのコピー)
  - [2. 環境変数の設定](#2-環境変数の設定)
- [Claude Code（MCP設定）](#claude-codemcp設定)
- [開発ルール](#開発ルール)
  - [1. 命名規則](#1-命名規則)
  - [2. 基本コマンド](#2-基本コマンド)
  - [3. pnpm ワークスペースコマンド](#3-pnpm-ワークスペースコマンド)
  - [4. 環境変数の管理コマンド](#4-環境変数の管理コマンド)
  - [5. Docker環境の起動コマンド](#5-docker環境の起動コマンド)

## プロジェクト構成図

```mermaid
graph TB
    subgraph Apps
        Web["apps/web<br/>Next.js 16 :3000"]
        Admin["apps/admin<br/>Next.js 16 :3030"]
        Mobile["apps/mobile<br/>Expo / React Native"]
        API["apps/api<br/>Express 5 :8080"]
        Cron["apps/cron<br/>定期実行タスク (1回 exit)"]
        Worker["apps/worker<br/>BullMQ 常駐 worker"]
    end

    subgraph Packages
        Schema["packages/schema<br/>Zod スキーマ / 型定義"]
        DB["packages/db<br/>Prisma schema + createPrismaClient"]
        Logger["packages/logger<br/>ILogger + pino/winston/console/silent"]
        Errors["packages/errors<br/>Result&lt;T&gt; + ApiError"]
        RedisPkg["packages/redis<br/>createRedisClient (ioredis)"]
        Queue["packages/queue<br/>JobQueue&lt;T&gt; 抽象 + BullMQ 実装"]
    end

    subgraph Infra
        Terraform["infra/terraform<br/>AWS IaC"]
    end

    subgraph Infrastructure
        PostgreSQL[(PostgreSQL 16)]
        Redis[(Redis 7)]
    end

    Web --> API
    Admin --> API
    Mobile --> API
    API --> PostgreSQL
    API --> Redis
    API -->|enqueue| Queue
    Cron --> PostgreSQL
    Worker --> PostgreSQL
    Worker --> Redis
    Queue --> Redis
    Schema --> Web
    Schema --> Admin
    Schema --> Mobile
    Schema --> API
    DB --> API
    DB --> Cron
    DB --> Worker
    Logger --> API
    Logger --> Cron
    Logger --> Worker
    Errors --> API
    Errors --> Cron
    Errors --> Worker
    RedisPkg --> API
    RedisPkg --> Worker
    RedisPkg --> Queue
    Queue --> Worker
```

## 技術スタック

#### モノレポ・ビルド
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)

#### バックエンド
![Express](https://img.shields.io/badge/Express%205-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma%207-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)

#### フロントエンド
![Next.js](https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS%20v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

#### モバイル
![Expo](https://img.shields.io/badge/Expo%2054-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native%200.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)

#### 認証
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google%20OAuth-4285F4?style=for-the-badge&logo=google&logoColor=white)

#### データベース・キャッシュ
![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2016-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis%207-DC382D?style=for-the-badge&logo=redis&logoColor=white)

#### テスト
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)

#### ロギング・環境変数
![Pino](https://img.shields.io/badge/Pino-687634?style=for-the-badge&logo=pino&logoColor=white)
![dotenvx](https://img.shields.io/badge/dotenvx-000000?style=for-the-badge&logo=dotenv&logoColor=white)

#### インフラ・CI/CD
![AWS](https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white)
![ECS Fargate](https://img.shields.io/badge/ECS%20Fargate-FF9900?style=for-the-badge&logo=amazonecs&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

## クイックリファレンス

### セットアップ手順 (まずここから)

| ドキュメント | 内容 |
|---|---|
| [docs/setup/api.md](docs/setup/api.md) | API サーバーのローカル起動 (依存インストール / .env.keys / Postgres+Redis / Prisma / dev サーバー / テスト) |
| [docs/setup/infra.md](docs/setup/infra.md) | AWS インフラ初回セットアップ (bootstrap → account → GitHub Environments → env apply → DNS 委任 → seed-secrets → image push) |

設計や運用方針は各 README:

| ドキュメント | 内容 |
|---|---|
| [apps/api/README.md](apps/api/README.md) | API サーバーの設計思想 (レイヤード / Result 型 / DI / テスト戦略) |
| [infra/README.md](infra/README.md) | インフラ構成 / dev・prd の差分 / デプロイフロー / 日常運用コマンド |

### 仕様 / 設計

| ドキュメント | 内容 |
|---|---|
| [docs/spec/README.md](docs/spec/README.md) | 機能仕様クイックリファレンス（dev-login / shared-packages 等） |
| [docs/spec/shared-packages/README.md](docs/spec/shared-packages/README.md) | packages/db, logger, errors, config, redis 切り出しの設計書 |
| [docs/mcp.md](docs/mcp.md) | MCP サーバーの一覧・使い方・追加方法 |
| [.claude/README.md](.claude/README.md) | Claude Code の設定（Agents・Commands・Skills） |

---

## テンプレートの使い方

### 1. プロジェクトのコピー

`scripts/copy-template.sh` を実行して、テンプレートを新しいプロジェクトとしてコピーします。

```bash
# 例: プロジェクト名を明示的に指定
./scripts/copy-template.sh ../my-new-app my-new-app

# 例: 絶対パスで指定 ⚠️ プロジェクト名を省略した場合、コピー先ディレクトリ名が使用される
./scripts/copy-template.sh ~/workspace/my-new-app
```

### 2. 環境変数の設定

各アプリの `.env.local` は [dotenvx](https://dotenvx.com/) で暗号化されています。復号に必要な `.env.keys` を管理者から受け取り、プロジェクトルートに配置してください。

各アプリ (`apps/api`, `apps/web`, `apps/admin`, `apps/mobile`, `apps/cron`, `apps/worker`) にはルートへのシンボリックリンクが git に含まれているため、ルートに置くだけで全アプリから参照されます。

```
<project-root>/
├── .env.keys                        ← ここに配置
├── apps/
│   ├── api/.env.keys    → ../../.env.keys   (シンボリックリンク)
│   ├── web/.env.keys    → ../../.env.keys   (シンボリックリンク)
│   ├── admin/.env.keys  → ../../.env.keys   (シンボリックリンク)
│   ├── mobile/.env.keys → ../../.env.keys   (シンボリックリンク)
│   ├── cron/.env.keys   → ../../.env.keys   (シンボリックリンク)
│   └── worker/.env.keys → ../../.env.keys   (シンボリックリンク)
```

<details>
<summary>（管理者向け）.env.keys の作成方法とシンボリックリンクの貼り方</summary>

ゼロからプロジェクトをセットアップする管理者向けの手順です。既に `.env.keys` を受け取っている開発者は実施不要です。

```bash
# 1. ルートで .env.keys を生成（初回 set でついでに鍵が作られる）
npx dotenvx set _BOOTSTRAP "x" -f .env.local
rm .env.local                          # ← ルートに .env.local は要らないので削除

# 2. 各アプリにルートを指すシンボリックリンクを張る
ln -s ../../.env.keys apps/api/.env.keys
ln -s ../../.env.keys apps/web/.env.keys
ln -s ../../.env.keys apps/admin/.env.keys
ln -s ../../.env.keys apps/mobile/.env.keys
ln -s ../../.env.keys apps/cron/.env.keys
ln -s ../../.env.keys apps/worker/.env.keys
```

以降は **必ずプロジェクトルートから** `npx dotenvx set KEY "value" -f apps/<app>/.env.local` を実行すること（各アプリで `cd` して直接叩くと、シンボリックリンクが実体ファイルで上書きされ、アプリごとに別の鍵ペアが生成されてしまう）。

</details>

## Claude Code（MCP設定）

このプロジェクトでは MCP サーバーの設定ファイル（`.mcp.json`）をリポジトリルートに配置しています。Claude Code 起動時に MCP サーバーを認識させるには、以下のコマンドを使用してください:

```bash
claude --mcp-config=./.mcp.json
```

MCP サーバーの詳細は [docs/mcp.md](docs/mcp.md) を参照してください。

## 開発ルール

### 1. 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| ディレクトリ | kebab-case | `user-profile/`, `api-schema/` |
| 一般ファイル（hooks, utils, lib等） | kebab-case | `use-auth.ts`, `api-client.ts`, `format-date.ts` |
| Componentをexportするファイル | PascalCase | `UserProfile.tsx`, `LoginForm.tsx`, `Button.tsx` |
| テストファイル | テスト対象の関数名 + `.test.ts` | `getUserById.test.ts`, `authenticateWithGoogle.test.ts` |

### 2. 基本コマンド

```bash
pnpm dev          # 全アプリを開発モードで起動
pnpm build        # 全アプリをビルド
pnpm lint         # ESLint 実行
pnpm lint:fix     # ESLint 自動修正
pnpm test         # テスト実行
```

### 3. pnpm ワークスペースコマンド

```bash
# 特定のワークスペースでコマンドを実行
pnpm --filter <workspace-name> <command>

# 例: webアプリのみ起動
pnpm --filter web dev

# すべてのワークスペースに依存関係を追加
pnpm add -w <package-name>

# 特定のワークスペースに依存関係を追加
pnpm --filter <workspace-name> add <package-name>

# 特定のワークスペースのdevDependenciesに依存関係を追加
pnpm --filter web add -D @types/node

# 依存関係を削除
pnpm --filter <workspace-name> remove <package-name>

# すべての node_modules を削除して再インストール
pnpm clean && pnpm install
```

### 4. 環境変数の管理コマンド

```bash
# .env.local の暗号化
cd apps/api && pnpm exec dotenvx encrypt -f .env.local

# .env.local の復号化
cd apps/api && pnpm exec dotenvx decrypt -f .env.local
```

### 5. Docker環境の起動コマンド

```bash
# Dockerコンテナを起動
docker compose up -d

# コンテナの状態を確認
docker compose ps

# ログを確認
docker compose logs -f

# コンテナを停止
docker compose down

# データを含めて完全に削除
docker compose down -v
```
# nodebase
