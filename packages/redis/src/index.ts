export { createRedisClient } from "./client"
export type { CreateRedisClientOptions } from "./client"

/**
 * ioredis の型を re-export
 * 利用側は import type { Redis, RedisOptions } from "@repo/redis" で参照できる
 */
export type { Redis, RedisOptions } from "ioredis"
export { default as IoRedis } from "ioredis"
