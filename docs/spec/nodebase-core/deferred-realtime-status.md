# deferred: ノード実行ステータスのリアルタイム表示

MVP ではユーザーは「実行」ボタンを押した後、エディタ画面の「実行履歴」リンクから完了状態を polling で確認する。reference の Inngest Realtime channel のような「ノードごとに loading / success / error がリアルタイムに切り替わる」表示は実装しない。

## 着手トリガー

- ユーザーから「実行中の進捗が見えない」「どのノードで止まっているか分からない」という声が複数件出る
- ワークフローが大型化して、polling では UX が不十分になる
- 1 ワークフローあたりのノード数が平均 10 超になる

## 対象範囲（MVP 含む / 含まない の対比）

| 機能 | MVP | 将来 |
| --- | :---: | :---: |
| 「実行」押下後の executionId 取得 | ✅ | - |
| 実行履歴詳細での「ノード別ステータス」一覧表示 | ✅ | - |
| **エディタ上のキャンバスでノードが点滅 / 色変化** | - | ✅ |
| **完了 polling**（数秒間隔で `GET /api/executions/:id`） | ✅ | - |
| **Server-Sent Events / WebSocket でのストリーミング更新** | - | ✅ |

## 設計案（着手時に詰める）

候補 A: **SSE（Server-Sent Events）**
- API: `GET /api/executions/:id/stream`（text/event-stream）
- Worker → Redis Pub/Sub（`execution:<id>:status` チャネル） → API がサブスクライブして SSE 送信
- 利点: HTTP 互換、proxy も通りやすい

候補 B: **WebSocket**
- 双方向は不要なので過剰。SSE を優先

候補 C: **polling のまま、間隔を短くする**
- 実装コスト最小だが、サーバ負荷が線形に増える

→ **候補 A（SSE + Redis Pub/Sub）が第一候補**。WorkerHub の概念を追加し、`@repo/redis` の `createPubSubClient()` を新設する想定。

## 既存仕様との差分（着手時のチェックリスト）

- [ ] `executions` テーブルに `node_executions` 子テーブルを追加（ノード別 status / startedAt / completedAt / output / error を行で持つ）
- [ ] Worker 側でノード実行の前後に Redis Pub/Sub publish
- [ ] API に SSE endpoint 追加（認証は existing JWT cookie をそのまま使う）
- [ ] エディタ（React Flow）でノードの border color を status に応じて変える
- [ ] polling は SSE の fallback として残す（古いブラウザ・proxy 環境用）
- [ ] テスト: Worker → Pub/Sub publish → SSE 受信のフローを e2e に組み込む
