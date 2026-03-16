"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  const content = String(formData.get("content") ?? "").trim();
  const chatIdValue = String(formData.get("chatId") ?? "").trim();

  if (!content) {
    redirect(chatIdValue ? `/chat?chatId=${chatIdValue}` : "/chat");
  }

  redirect(chatIdValue ? `/chat?chatId=${chatIdValue}` : "/chat");
}
