import type { Redis } from "@repo/redis"

/**
 * Refresh Token リポジトリのインターフェース
 * Refresh Token は jti（JWT ID）をキーに userId を保存する。
 * ローテーション時は旧 jti を delete、新 jti を save する。
 */
export interface RefreshTokenRepository {
    delete(jti: string): Promise<void>
    findUserId(jti: string): Promise<number | null>
    save(jti: string, userId: number, ttlSeconds: number): Promise<void>
}

const keyOf = (jti: string): string => `refresh_token:${jti}`

/**
 * ioredis 実装の Refresh Token リポジトリ
 */
export class IoRedisRefreshTokenRepository implements RefreshTokenRepository {
  private _redis: Redis

  constructor(redis: Redis) {
    this._redis = redis
  }

  public async save(jti: string, userId: number, ttlSeconds: number): Promise<void> {
    await this._redis.set(keyOf(jti), String(userId), "EX", ttlSeconds)
  }

  public async findUserId(jti: string): Promise<number | null> {
    const raw = await this._redis.get(keyOf(jti))
    return raw === null ? null : Number(raw)
  }

  public async delete(jti: string): Promise<void> {
    await this._redis.del(keyOf(jti))
  }
}
