import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { generateChatReplyStream } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { buildChatTitle, ensureChatForUser } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { appendChatMessageToCache } from "@/lib/message-cache";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await request.json()) as {
    content?: unknown;
    chatId?: unknown;
  };
  const content =
    typeof body.content === "string" ? body.content.trim() : "";
  const chatIdValue =
    typeof body.chatId === "string" ? body.chatId.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "消息内容不能为空" }, { status: 400 });
  }

  const { chatId } = await ensureChatForUser({
    chatId: chatIdValue,
    userId: session.user.id,
    content,
  });
  // 同步到数据库
  const userMessage = await prisma.message.create({
    data: {
      role: "user",
      content,
      chatId,
    },
  });
  // 同步到缓存
  await appendChatMessageToCache(userMessage);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeEvent = (event: string, data: Record<string, string>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      writeEvent("meta", { chatId });

      try {
        let assistantContent = "";

        const finalContent = await generateChatReplyStream(chatId, (chunk) => {
          assistantContent += chunk;
          writeEvent("delta", { content: chunk });
        });

        assistantContent = finalContent;
        // 输出到数据库
        const assistantMessage = await prisma.message.create({
          data: {
            role: "assistant",
            content: assistantContent,
            chatId,
          },
        });
        // 同步到缓存
        await appendChatMessageToCache(assistantMessage);

        await prisma.chat.update({
          where: {
            id: chatId,
          },
          data: {
            title: buildChatTitle(content),
          },
        });

        revalidatePath("/chat");
        writeEvent("done", { chatId, content: assistantContent });
      } catch (error) {
        const assistantContent =
          error instanceof Error
            ? `模型调用失败：${error.message}`
            : "模型调用失败，请稍后再试。";

        const assistantMessage = await prisma.message.create({
          data: {
            role: "assistant",
            content: assistantContent,
            chatId,
          },
        });
        await appendChatMessageToCache(assistantMessage);

        await prisma.chat.update({
          where: {
            id: chatId,
          },
          data: {
            title: buildChatTitle(content),
          },
        });

        revalidatePath("/chat");
        writeEvent("error", { message: assistantContent, chatId });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
