import { generateAccessToken, generateRefreshToken } from "../src/lib/jwt"

/**
 * テスト・動作確認用に access_token と refresh_token を標準出力に JSON で吐く CLI。
 * dev DB に存在する user の id を渡すこと。Refresh Token は Redis に登録しないので、
 * トークンローテーション動作の検証には使えない（純粋に画面の認証突破用）。
 *
 * 使い方:
 *   pnpm --filter api issue-test-token <userId>
 */
const main = () => {
  const userId = Number(process.argv[2])
  if (!Number.isInteger(userId) || userId <= 0) {
    process.stderr.write("Usage: ts-node scripts/issue-test-token.ts <userId>\n")
    process.exit(1)
  }
  const access = generateAccessToken(userId)
  const { token: refresh } = generateRefreshToken(userId)
  process.stdout.write(`${JSON.stringify({ access, refresh, userId })}\n`)
}

main()
