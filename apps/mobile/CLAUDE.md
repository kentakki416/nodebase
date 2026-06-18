# apps/mobile

Expo + React Native アプリケーション。expo-router によるファイルベースルーティング。

## Commands

```bash
pnpm start        # Expo dev server
pnpm android      # Android で起動
pnpm ios          # iOS で起動
```

## アーキテクチャ

- ファイルベースルーティング: `app/` ディレクトリ
- ナビゲーション: React Navigation（bottom tabs）
- テーマ: `@react-navigation/native`
- 型・スキーマは `@repo/api-schema` から import（**ローカル独自定義は禁止**：API 側の変更に追従できず型不整合バグが発生するため）
