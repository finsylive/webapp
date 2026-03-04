import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

/**
 * Get Upstash Redis client. Returns null if env vars are not configured.
 * Graceful degradation — feed works without Redis, just slower (Postgres-only).
 */
export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}
