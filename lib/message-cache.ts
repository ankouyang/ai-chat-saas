import { prisma } from "@/lib/db";
import { getRedisClient, isRedisConfigured } from "@/lib/redis";

export type CachedChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  chatId: string;
};

const DEFAULT_MESSAGE_CACHE_TTL_MS = 15_000;
const AI_HISTORY_LIMIT = 12;

function resolveMessageCacheTtlMs() {
  const raw = process.env.MESSAGE_CACHE_TTL_MS?.trim();
  const ttlMs = raw ? Number(raw) : DEFAULT_MESSAGE_CACHE_TTL_MS;

  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    return DEFAULT_MESSAGE_CACHE_TTL_MS;
  }

  return ttlMs;
}

function resolveMessageCacheTtlSeconds() {
  return Math.max(1, Math.ceil(resolveMessageCacheTtlMs() / 1000));
}

function getFullMessagesCacheKey(chatId: string) {
  return `chat:messages:full:${chatId}`;
}

function getRecentMessagesCacheKey(chatId: string, take: number) {
  return `chat:messages:recent:${take}:${chatId}`;
}

function deserializeMessages(
  raw: string | Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string | Date;
    chatId: string;
  }> | null,
) {
  if (!raw) {
    return null;
  }

  try {
    const parsed =
      typeof raw === "string"
        ? (JSON.parse(raw) as Array<{
            id: string;
            role: "user" | "assistant" | "system";
            content: string;
            createdAt: string;
            chatId: string;
          }>)
        : raw;

    return parsed.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
    }));
  } catch (error) {
    console.error("[message-cache.deserialize_failed]", error);
    return null;
  }
}

async function readMessagesFromRedis(cacheKey: string) {
  const redis = getRedisClient();

  if (!redis) {
    return null;
  }

  try {
    return deserializeMessages(await redis.get(cacheKey));
  } catch (error) {
    console.error("[message-cache.read_failed]", { cacheKey, error });
    return null;
  }
}

async function writeMessagesToRedis(cacheKey: string, messages: CachedChatMessage[]) {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    await redis.set(cacheKey, messages, {
      EX: resolveMessageCacheTtlSeconds(),
    });
  } catch (error) {
    console.error("[message-cache.write_failed]", { cacheKey, error });
  }
}

async function queryMessagesFromDatabase(chatId: string, take?: number) {
  if (take) {
    const messages = await prisma.message.findMany({
      where: {
        chatId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        chatId: true,
      },
    });

    return [...messages].reverse();
  }

  return prisma.message.findMany({
    where: {
      chatId,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      chatId: true,
    },
  });
}

export async function listChatMessages(chatId: string) {
  const cacheKey = getFullMessagesCacheKey(chatId);
  const cached = await readMessagesFromRedis(cacheKey);

  if (cached) {
    return cached;
  }

  const messages = await queryMessagesFromDatabase(chatId);

  if (isRedisConfigured()) {
    await writeMessagesToRedis(cacheKey, messages);
  }

  return messages;
}

export async function listRecentChatMessages(chatId: string, take = AI_HISTORY_LIMIT) {
  const cacheKey = getRecentMessagesCacheKey(chatId, take);
  const cached = await readMessagesFromRedis(cacheKey);

  if (cached) {
    return cached;
  }

  const messages = await queryMessagesFromDatabase(chatId, take);

  if (isRedisConfigured()) {
    await writeMessagesToRedis(cacheKey, messages);
  }

  return messages;
}

export async function appendChatMessageToCache(message: CachedChatMessage) {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  const fullKey = getFullMessagesCacheKey(message.chatId);
  const recentKey = getRecentMessagesCacheKey(message.chatId, AI_HISTORY_LIMIT);

  try {
    const [fullRaw, recentRaw] = await Promise.all([
      redis.get(fullKey),
      redis.get(recentKey),
    ]);

    const fullMessages = deserializeMessages(fullRaw);
    const recentMessages = deserializeMessages(recentRaw);

    const writes: Promise<unknown>[] = [];

    if (fullMessages) {
      writes.push(
        redis.set(fullKey, [...fullMessages, message], {
          EX: resolveMessageCacheTtlSeconds(),
        }),
      );
    }

    if (recentMessages) {
      const nextRecentMessages = [...recentMessages, message].slice(-AI_HISTORY_LIMIT);

      writes.push(
        redis.set(recentKey, nextRecentMessages, {
          EX: resolveMessageCacheTtlSeconds(),
        }),
      );
    }

    await Promise.all(writes);
  } catch (error) {
    console.error("[message-cache.append_failed]", {
      chatId: message.chatId,
      error,
    });
  }
}

export async function invalidateChatMessageCache(chatId: string) {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    await Promise.all([
      redis.del(getFullMessagesCacheKey(chatId)),
      redis.del(getRecentMessagesCacheKey(chatId, AI_HISTORY_LIMIT)),
    ]);
  } catch (error) {
    console.error("[message-cache.invalidate_failed]", { chatId, error });
  }
}
