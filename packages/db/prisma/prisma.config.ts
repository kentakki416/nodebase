import { defineConfig } from "prisma/config"

const DEFAULT_URL = "postgresql://postgres:password@localhost:5432/nodebase_dev"

/**
 * DB_NAME 環境変数が設定されている場合、DATABASE_URL のDB名部分を置き換える
 * テスト実行時に DB_NAME=nodebase_test を指定することで、
 * テスト用DBにマイグレーションを適用できる
 *
 * DATABASE_URL が未設定の場合はローカルのデフォルトを使う（prisma generate 時など）
 */
const getDatasourceUrl = (): string => {
  const baseUrl = process.env.DATABASE_URL ?? DEFAULT_URL
  const dbName = process.env.DB_NAME
  if (!dbName) return baseUrl
  return baseUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`)
}

export default defineConfig({
  datasource: {
    url: getDatasourceUrl(),
  },
  migrations: {
    path: "./migrations",
    seed: "npx tsx ./prisma/seed.ts"
  },
  schema: "./schema.prisma",
})
