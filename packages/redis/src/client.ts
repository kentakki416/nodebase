import Redis, { type RedisOptions } from "ioredis"

export type CreateRedisClientOptions = {
  /**
   * 接続 URL を明示指定（例: redis://:password@host:6379/0）
   * 省略時は process.env.REDIS_URL を優先し、無ければ個別の
   * REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB から組み立てる
   */
  url?: string
  /**
   * ioredis に追加で渡したいオプション
   * 例: { maxRetriesPerRequest: null } (BullMQ Queue/Worker 用)
   *     { lazyConnect: true } (テスト用)
   *     { keyPrefix: "myapp:" } (キー名衝突回避)
   */
  options?: RedisOptions
}

/**
 * 環境変数から ioredis に渡すオプションを組み立てる
 * REDIS_URL が優先される。無ければ REDIS_HOST/PORT/PASSWORD/DB を個別に読む
 */
const buildOptionsFromEnv = (): RedisOptions | string => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  return {
    db: Number(process.env.REDIS_DB) || 0,
    host: process.env.REDIS_HOST || "localhost",
    password: process.env.REDIS_PASSWORD || undefined,
    port: Number(process.env.REDIS_PORT) || 6379,
  }
}

/**
 * ioredis クライアントのファクトリ
 * 各 app の src/index.ts で 1 回呼び、Repository コンストラクタに渡す。
 * BullMQ や Pub/Sub の subscriber などは別接続が必須なので、
 * 用途ごとに複数回呼んで使い分ける。
 */
export const createRedisClient = (params: CreateRedisClientOptions = {}): Redis => {
  if (params.url) {
    return new Redis(params.url, params.options ?? {})
  }
  const base = buildOptionsFromEnv()
  if (typeof base === "string") {
    return new Redis(base, params.options ?? {})
  }
  return new Redis({ ...base, ...params.options })
}
