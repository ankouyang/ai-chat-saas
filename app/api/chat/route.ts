import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { generateChatReplyStream, getModelErrorMessage } from "@/lib/ai";
import { auth } from "@/lib/auth";
import { buildChatTitle, ensureChatForUser } from "@/lib/chat";
import { prisma } from "@/lib/db";
import { createTraceId, logChatTrace, logChatTraceError } from "@/lib/chat-trace";
import { appendChatMessageToCache } from "@/lib/message-cache";

export async function POST(request: Request) {
  const traceId = createTraceId();
  const session = await auth();

  if (!session?.user?.id) {
    logChatTraceError("request.unauthorized", { traceId });
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

  logChatTrace("request.start", {
    traceId,
    userId: session.user.id,
    requestedChatId: chatIdValue || null,
    contentLength: content.length,
  });

  if (!content) {
    logChatTraceError("request.invalid_payload", {
      traceId,
      userId: session.user.id,
    });
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
  logChatTrace("db.user_message.persisted", {
    traceId,
    chatId,
    messageId: userMessage.id,
  });
  // 同步到缓存
  await appendChatMessageToCache(userMessage, {
    source: "route",
    traceId,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let chunkCount = 0;

      const writeEvent = (event: string, data: Record<string, string>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      writeEvent("meta", { chatId });
      logChatTrace("stream.meta.sent", {
        traceId,
        chatId,
      });

      try {
        let assistantContent = "";

        const finalContent = await generateChatReplyStream(
          chatId,
          (chunk) => {
            assistantContent += chunk;
            chunkCount += 1;
            writeEvent("delta", { content: chunk });
          },
          traceId,
        );

        assistantContent = finalContent;
        // 输出到数据库
        const assistantMessage = await prisma.message.create({
          data: {
            role: "assistant",
            content: assistantContent,
            chatId,
          },
        });
        logChatTrace("db.assistant_message.persisted", {
          traceId,
          chatId,
          messageId: assistantMessage.id,
          contentLength: assistantContent.length,
        });
        // 同步到缓存
        await appendChatMessageToCache(assistantMessage, {
          source: "route",
          traceId,
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
        writeEvent("done", { chatId, content: assistantContent });
        logChatTrace("stream.done.sent", {
          traceId,
          chatId,
          chunkCount,
          contentLength: assistantContent.length,
        });
      } catch (error) {
        const assistantContent = `模型调用失败：${getModelErrorMessage(error)}`;

        logChatTraceError("request.failed", {
          traceId,
          chatId,
          error,
        });

        const assistantMessage = await prisma.message.create({
          data: {
            role: "assistant",
            content: assistantContent,
            chatId,
          },
        });
        logChatTrace("db.assistant_error_message.persisted", {
          traceId,
          chatId,
          messageId: assistantMessage.id,
        });
        await appendChatMessageToCache(assistantMessage, {
          source: "route",
          traceId,
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
        writeEvent("error", { message: assistantContent, chatId });
        logChatTrace("stream.error.sent", {
          traceId,
          chatId,
        });
      } finally {
        logChatTrace("request.complete", {
          traceId,
          chatId,
        });
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
