"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { generateChatReply } from "@/lib/ai";
import { prisma } from "@/lib/db";

function buildChatTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "新对话";
  }

  return normalized.slice(0, 24);
}

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return session.user;
}

export async function createChatAction() {
  const user = await requireUser();

  const chat = await prisma.chat.create({
    data: {
      title: "新对话",
      userId: user.id,
    },
  });

  revalidatePath("/chat");
  redirect(`/chat?chatId=${chat.id}`);
}

export async function sendMessageAction(formData: FormData) {
  const user = await requireUser();
  const content = String(formData.get("content") ?? "").trim();
  const chatIdValue = String(formData.get("chatId") ?? "").trim();

  if (!content) {
    redirect(chatIdValue ? `/chat?chatId=${chatIdValue}` : "/chat");
  }

  let chatId = chatIdValue;

  if (chatId) {
    const existingChat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });
    if (!existingChat) {
      chatId = "";
    }
  }

  if (!chatId) {
    const chat = await prisma.chat.create({
      data: {
        title: buildChatTitle(content),
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    chatId = chat.id;
  }

  await prisma.message.create({
    data: {
      role: "user",
      content,
      chatId,
    },
  });

  let assistantContent = "";

  try {
    assistantContent = await generateChatReply(chatId);
  } catch (error) {
    assistantContent =
      error instanceof Error
        ? `模型调用失败：${error.message}`
        : "模型调用失败，请稍后再试。";
  }

  await prisma.message.create({
    data: {
      role: "assistant",
      content: assistantContent,
      chatId,
    },
  });

  await prisma.chat.update({
    where: {
      id: chatId,
    },
    data: {
      title: buildChatTitle(content),
    },
  });

  revalidatePath("/chat");
  redirect(`/chat?chatId=${chatId}`);
}
