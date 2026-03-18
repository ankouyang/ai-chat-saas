import { Redis } from "@upstash/redis";

let redisClient: Redis | null | undefined;

function resolveUpstashConfig() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL?.trim() || "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || "",
  };
}

export function isRedisConfigured() {
  const { url, token } = resolveUpstashConfig();

  return Boolean(url && token);
}

export function getRedisClient() {
  if (!isRedisConfigured()) {
    return null;
  }

  if (redisClient === undefined) {
    redisClient = Redis.fromEnv();
  }

  return redisClient;
}
