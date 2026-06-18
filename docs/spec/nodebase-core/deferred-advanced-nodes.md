# deferred: 追加ノード（Slack / Discord / Anthropic / Gemini / 外部 Webhook トリガー）

MVP では **Manual Trigger / Webhook Trigger / HTTP Request / OpenAI** のみを実装する。reference には他にも以下のノードがあるが、MVP では割愛する。

## 着手トリガー

以下のいずれかが発生したときに着手する。

- ユーザーから「Slack 連携が欲しい」「Anthropic / Gemini も使いたい」等の具体的な要望が複数件出る
- MVP の Manual + Webhook + HTTP + OpenAI で n8n クローンとして「物足りない」というフィードバックが揃う
- 競合（n8n / Make 等）のキャッチアップとして、特定の連携先のシェアが伸びている指標が出る

## 対象範囲（MVP 含む / 含まない の対比）

| ノード | MVP | 将来 |
| --- | :---: | :---: |
| Manual Trigger | ✅ | - |
| Webhook Trigger（汎用） | ✅ | - |
| HTTP Request | ✅ | - |
| OpenAI | ✅ | - |
| Anthropic | - | ✅ |
| Gemini | - | ✅ |
| Slack（webhook 投稿） | - | ✅ |
| Discord（webhook 投稿） | - | ✅ |
| Stripe Trigger（webhook 受信） | - | ✅ |
| Google Form Trigger（webhook 受信） | - | ✅ |
| Cron Trigger | - | ✅ |
| Email 送信（SendGrid 等） | - | ✅ |

## 設計案（着手時に詰める）

- ノード追加 = **NodeType enum + NodeExecutor 実装 + Zod schema** の 1 セット。基盤は MVP で完成しているため、追加は機械的
- AI 系（Anthropic / Gemini）は `@ai-sdk/anthropic` / `@ai-sdk/google` を使い、OpenAI Executor とほぼ同じ構造で実装可能
- Stripe / Google Form のような **特定サービス向け Webhook Trigger** は、汎用 Webhook Trigger と別ノードにするか、汎用に「期待するペイロード形式」のヒントを付与するかを決める必要がある
- Cron Trigger は `apps/cron` 側で `workflow_cron_schedules` テーブルを定期スキャンして enqueue する設計

## 既存仕様との差分（着手時のチェックリスト）

- [ ] `NodeType` enum に新規エントリ追加（`packages/schema` の Zod enum も同期）
- [ ] `NodeExecutorRegistry` に新規 executor を登録
- [ ] エディタ側で「ノード追加」メニューに項目を増やす
- [ ] ノード詳細ダイアログのテンプレート（form schema）を追加
- [ ] テストデータ（fixture）を追加
- [ ] Slack / Discord 等の「外部送信系」は **テストで外部 HTTP を mock する**（CI で実 API は叩かない）
- [ ] Stripe / Google Form のような **Webhook 受信側**は、`webhook_key` の発番ルールが汎用 Webhook Trigger と衝突しないことを確認
- [ ] Cron Trigger は `apps/cron` の README に新規 task として追記
