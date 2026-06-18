import type { Redis } from "@repo/redis"

/**
 * Redisのヘルスチェック用リポジトリのインターフェース
 */
export interface RedisHealthRepository {
  ping(): Promise<void>
}

/**
 * ioredis実装のRedisヘルスチェックリポジトリ
 */
export class IoRedisHealthRepository implements RedisHealthRepository {
  private _redis: Redis

  constructor(redis: Redis) {
    this._redis = redis
  }

  public async ping(): Promise<void> {
    await this._redis.ping()
  }
}
