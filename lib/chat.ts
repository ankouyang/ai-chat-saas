import { prisma } from "@/lib/db";

export function buildChatTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "新对话";
  }

  return normalized.slice(0, 24);
}

export async function ensureChatForUser({
  chatId,
  userId,
  content,
}: {
  chatId?: string;
  userId: string;
  content: string;
}) {
  const normalizedChatId = chatId?.trim();

  if (normalizedChatId) {
    const existingChat = await prisma.chat.findFirst({
      where: {
        id: normalizedChatId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (existingChat) {
      return {
        chatId: existingChat.id,
        created: false,
      };
    }
  }

  const chat = await prisma.chat.create({
    data: {
      title: buildChatTitle(content),
      userId,
    },
    select: {
      id: true,
    },
  });

  return {
    chatId: chat.id,
    created: true,
  };
}
