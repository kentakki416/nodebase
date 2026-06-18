---
name: verify-web-page
description: フロントエンド（apps/web、apps/admin）の実装・修正後に Playwright MCP で実画面の動作確認を行い、Web の PR には before/after スクショを必ず添える skill。dev サーバの起動確認、認証必須ページへの JWT cookie 注入、navigate / console_messages / snapshot による検証、`docs/screenshots/{feature}/{before,after}.png` の撮影と PR 本文埋め込みまでを標準化する。`pnpm build` だけで「動作確認済み」と報告するのは禁止であり、UI コードを書いたら必ずこの skill を実行する。ユーザーが「動作確認して」「画面で確認して」「ちゃんと動くか」と尋ねた場合、または UI 実装直後に自発的に呼び出す。
---

# verify-web-page

UI コードを書いた直後に **必ず** 実行する skill。役割は以下:

1. **動作確認**: navigate / console error / snapshot で実画面を検証（`pnpm build` 通過だけでは検出できない不具合を捕捉）
2. **PR 用 before/after スクショ**: 見た目に影響する PR には `docs/screenshots/{feature}/{before,after}.png` を必ず添付する

## 対象

- `apps/web`（port 3000）
- `apps/admin`（port 3030）— Admin 認証は将来実装。現状はそのまま navigate

## ⚠️ 最重要: ブランチを切る前に before を撮る

既存ページを修正する PR では **必ず main の状態で before スクショを撮ってからブランチを切る**。撮り忘れて実装に入ったら、`git stash` → `git checkout main` → 撮影 → 戻す、で復元できる。

新規ページ作成 / 純粋なリファクタ / 裏側変更だけで見た目に影響しない PR は before 不要。after も不要なケースがある（後述）。

## フロー全体像

```
[既存ページ修正]                     [新規ページ作成]
  main で before を撮影              （before スキップ）
  ↓                                  ↓
  ブランチを切る                     ブランチを切る
  ↓                                  ↓
  実装                                実装
  ↓                                  ↓
  動作確認 (Step 1〜4)               動作確認 (Step 1〜4)
  ↓                                  ↓
  after を撮影 (Step 5)              after を撮影 (Step 5)
  ↓                                  ↓
  画像も含めて commit & push          画像も含めて commit & push
  ↓                                  ↓
  PR に before/after を埋め込む       PR に after のみ埋め込む
```

## 進め方

### Step 0: 実装前に before スクショ（既存ページ修正時のみ）

`git status` が clean で main にいることを確認した上で:

1. dev サーバが起動していることを確認（後述 Step 1 と同じ）
2. 認証が必要なら Step 3 と同じ手順で cookie 注入
3. 撮影:
   ```js
   mcp__playwright__browser_navigate({ url: "http://localhost:3000/<path>" })
   mcp__playwright__browser_take_screenshot({
     type: "png",
     filename: "docs/screenshots/<feature>/before.png",
     fullPage: true,
   })
   ```
4. **撮影後にブランチを切ってから実装に入る**

`<feature>` は PR の主題に対応した短い識別子（例: `profile-edit`, `matching-preferences`）。kebab-case を推奨。

### Step 1: dev サーバの起動確認

```bash
curl -s -o /dev/null -w "web=%{http_code} api=%{http_code}\n" http://localhost:3000 -o /dev/null && \
curl -s http://localhost:8080/api/health
```

- web が 200 / 307（middleware redirect） を返す
- api の `/api/health` が `{"status":"ok"}` を返す

両方走っていない場合: ユーザーに「`pnpm dev` を起動してください」と伝える。勝手に `pnpm dev` を `run_in_background` で立ち上げない（既存セッションと競合するリスク）。

### Step 2: 検証対象ページの認証要否を確認

| 認証要否 | 例 | 手順 |
|----------|------|------|
| 不要（PUBLIC_PATHS） | `/sign-in` | そのまま `browser_navigate` |
| 必要 | `/`, `/onboarding`, `/profile/:id`, `/matching/preferences` 等 | Step 3 で cookie を注入 |

`apps/web/src/middleware.ts` の `PUBLIC_PATHS` を見て判定する。

### Step 3: 認証必須ページの場合 — JWT を発行して cookie 注入

#### 3-1. テスト用ユーザーの id を確認

dev DB のユーザー一覧を Prisma Studio または DB 直結で確認する:

```bash
docker exec -i nodebase-postgres psql -U postgres -d "nodebase_dev" -At -c \
  "SELECT id, name, is_onboarded FROM users ORDER BY id LIMIT 10"
```

ユーザーがいない、もしくは `is_onboarded=false` で `/onboarding` 以外のページを検証したい場合、SQL で必要な状態に UPDATE する。

#### 3-2. JWT を発行

```bash
cd apps/api && pnpm issue-test-token <userId>
```

`{"access":"...","refresh":"...","userId":1}` が出力される。**access_token は 15 分しか有効でない** ため、検証セッションが長引いたら再発行する。

#### 3-3. Playwright に cookie を注入

```js
mcp__playwright__browser_evaluate({
  function: `() => {
    document.cookie = "app_access_token=<ACCESS>; path=/; max-age=900";
    document.cookie = "app_refresh_token=<REFRESH>; path=/; max-age=604800";
  }`
})
```

Cookie 名は `apps/web/src/libs/auth.ts` の `ACCESS_TOKEN_COOKIE` / `REFRESH_TOKEN_COOKIE` 定数（`app_access_token` / `app_refresh_token`）。

注入後にもう一度 `browser_navigate` で目的のページに遷移する（cookie 設定だけでは画面は再描画されない）。

### Step 4: 動作確認

```js
mcp__playwright__browser_navigate({ url: "http://localhost:3000/<path>" })
mcp__playwright__browser_console_messages({ level: "error" })
mcp__playwright__browser_snapshot({})
```

合格条件:

1. **`browser_navigate` が目的の URL のままで完了**（認証必須ページが `/sign-in?redirect=...` に飛んでいないこと）
2. **`browser_console_messages` の `level: "error"` が 0 件**
3. **`browser_snapshot` で意図した要素が見える**（仕様書で定義した見出し / フォーム項目 / アクションボタン等）

### Step 5: after スクショ（見た目に影響する PR は必須）

```js
mcp__playwright__browser_take_screenshot({
  type: "png",
  filename: "docs/screenshots/<feature>/after.png",
  fullPage: true,
})
```

Step 0 と同じ `<feature>` ディレクトリに保存する。

**after スクショが不要なケース**:
- リファクタや裏側のみの変更で UI が一切変わらない
- 設定ファイル / docs / skill / CLAUDE.md のみの PR

判断に迷ったら撮っておく方が安全。

### Step 6: エラーがあれば修正してループ

- console error が出ている → 該当箇所のソースを Read してエラー原因を特定 → 修正 → Step 4 から再実行
- snapshot に意図した要素がない → 仕様書とコードの齟齬を確認 → 修正 → 再実行

修正完了するまで「動作確認済み」と報告しない。

### Step 7: 画像を含めて commit & push、PR 本文に埋め込み

スクショは git に commit する（`gh` の API では PR 本文用の画像 CDN へ直接アップロードできないため、repo にコミットされた画像の raw URL を参照する以外の方法がない）。

```bash
git add docs/screenshots/<feature>/
# 既に他の変更を commit する流れの中で一緒に add してよい
git push
```

#### ⚠️ 画像 URL は必ず絶対 URL を使う

**PR 本文では相対パス（`docs/screenshots/...`）は表示されない**。GitHub は PR description / issue 本文の中で相対パスを repo の blob URL に解決しないため。必ず以下のテンプレ形式の絶対 URL を使う:

```
https://github.com/<owner>/<repo>/raw/<branch>/<path>
```

ブランチ名は今 push したブランチ（例: `feat/phase3-step10-web-matching-preferences`）。マージ後にブランチを削除すると URL は壊れるが、その時点では PR は閉じてレビューも完了しているので実害はない。長期保存が必要な場合は branch 名の代わりに commit SHA を使うと永続化できる。

URL は `gh repo view --json nameWithOwner -q .nameWithOwner` で `<owner>/<repo>` を、`git branch --show-current` で `<branch>` を取得して組み立てる。

`gh pr create --body` の本文に以下のテンプレを含める:

#### 既存ページ修正（before/after 両方）

```markdown
## Before / After

| Before | After |
|---|---|
| ![before](https://github.com/<owner>/<repo>/raw/<branch>/docs/screenshots/<feature>/before.png) | ![after](https://github.com/<owner>/<repo>/raw/<branch>/docs/screenshots/<feature>/after.png) |
```

#### 新規ページ作成（after のみ）

```markdown
## Screenshot

![after](https://github.com/<owner>/<repo>/raw/<branch>/docs/screenshots/<feature>/after.png)

> 新規ページのため before はなし
```

#### 見た目に影響しない PR

セクションごと省略してよい。代わりに「UI 変更なし（リファクタ / 裏側のみ）」と PR 本文に明記する。

PR 作成後にスクショを足したい場合は、追加コミットで `docs/screenshots/<feature>/` を push し、PR 本文を `gh pr edit <PR番号> --body "..."` で更新する。

## 失敗例（やってはいけないこと）

- `pnpm build` の通過だけで「動作確認済み」と報告する
- `browser_navigate` でリダイレクトされて `/sign-in` に着地しているのに気付かず OK 判定する
- console error を確認せず snapshot だけで OK 判定する（hydration error など UI 上は見えない不具合を見逃す）
- before スクショを撮らずに実装に着手する（既存ページ修正の場合）
- スクショを撮ったが commit せず PR を作る（PR の画像が表示されない）
- PR 本文で **相対パス** `![](docs/screenshots/...)` を使う（GitHub は PR 本文の相対パスを解決しないため画像が見えない。必ず絶対 URL `https://github.com/<owner>/<repo>/raw/<branch>/<path>` を使う）

## ユーザー向け報告フォーマット

```
動作確認結果（/<path>）:
- ステータス: 200 OK
- console errors: 0
- 表示確認: <主要要素 1>, <主要要素 2>, <アクションボタン>
- before/after: docs/screenshots/<feature>/{before,after}.png
- PR: #<番号>
```
