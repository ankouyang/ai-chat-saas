"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { ChatMessage } from "@/components/chat-message";

type MessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatWorkspaceProps = {
  initialChatId?: string;
  initialMessages: MessageItem[];
};

function createClientMessageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function ChatWorkspace({
  initialChatId,
  initialMessages,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const [chatId, setChatId] = useState(initialChatId ?? "");
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const assistantMessageIdRef = useRef("");
  const pendingChatIdRef = useRef("");
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    if (skipNextSyncRef.current && initialChatId === pendingChatIdRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    if (isStreaming) {
      return;
    }

    setChatId(initialChatId ?? "");
    setMessages(initialMessages);
  }, [initialChatId, initialMessages, isStreaming]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = content.trim();

    if (!trimmed || isStreaming) {
      return;
    }

    setErrorMessage("");

    const userMessage: MessageItem = {
      id: createClientMessageId("user"),
      role: "user",
      content: trimmed,
    };
    const assistantMessageId = createClientMessageId("assistant");
    assistantMessageIdRef.current = assistantMessageId;

    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      },
    ]);
    setContent("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: trimmed,
          chatId: chatId || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(errorText || "聊天请求失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const appendAssistantChunk = (chunk: string) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageIdRef.current
              ? { ...message, content: `${message.content}${chunk}` }
              : message,
          ),
        );
      };

      const processRawEvent = (rawEvent: string) => {
        const eventName =
          rawEvent
            .split("\n")
            .find((line) => line.startsWith("event:"))
            ?.slice(6)
            .trim() ?? "message";
        const dataText = rawEvent
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");

        if (!dataText) {
          return;
        }

        const payload = JSON.parse(dataText) as {
          chatId?: string;
          content?: string;
          message?: string;
        };

        if (eventName === "meta" && payload.chatId) {
          pendingChatIdRef.current = payload.chatId;
          skipNextSyncRef.current = true;
          setChatId(payload.chatId);
          router.replace(`/chat?chatId=${payload.chatId}`);
          return;
        }

        if (eventName === "delta" && payload.content) {
          appendAssistantChunk(payload.content);
          return;
        }

        if (eventName === "error") {
          const message = payload.message || "模型调用失败，请稍后再试。";

          setErrorMessage(message);
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessageIdRef.current
                ? { ...item, content: message }
                : item,
            ),
          );
          return;
        }

        if (eventName === "done" && payload.content !== undefined) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessageIdRef.current
                ? { ...item, content: payload.content ?? item.content }
                : item,
            ),
          );
        }
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes("\n\n")) {
          const separatorIndex = buffer.indexOf("\n\n");
          const rawEvent = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          processRawEvent(rawEvent);
        }
      }

      const remaining = buffer.trim();

      if (remaining) {
        processRawEvent(remaining);
      }

      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "聊天请求失败，请稍后再试。";

      setErrorMessage(message);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageIdRef.current
            ? { ...item, content: message }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <>
      <div className="flex-1 space-y-4">
        {messages.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[var(--color-ink)]/18 bg-white/55 px-5 py-8 text-sm leading-7 text-[var(--color-ink)]/60">
            当前还没有消息。你可以直接在下方输入一段需求，系统会自动创建会话，并在当前页面流式显示助手回复。
          </div>
        ) : null}
        {messages.map((message) => {
          const role = message.role === "user" ? "user" : "assistant";

          return (
            <ChatMessage
              key={message.id}
              role={role}
              title={role === "user" ? "你" : "灵感工位"}
              body={message.content || (isStreaming && role === "assistant" ? "正在生成..." : "")}
            />
          );
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-[30px] border border-[var(--color-ink)]/10 bg-white p-3 shadow-[0_25px_70px_rgba(38,30,24,0.08)]"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="sr-only">Message</span>
            <textarea
              name="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={isStreaming}
              className="min-h-28 w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-7 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink)]/35 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="可以让它帮你写标题、改文案、拆计划，或者把一个模糊想法整理清楚。"
            />
          </label>
          <button
            className="ink-button shrink-0 justify-center md:min-w-36 disabled:opacity-60"
            type="submit"
            disabled={isStreaming}
          >
            {isStreaming ? "生成中..." : "发送"}
          </button>
        </div>
        {errorMessage ? (
          <p className="px-3 pt-3 text-sm text-[var(--color-rust)]">
            {errorMessage}
          </p>
        ) : null}
      </form>
    </>
  );
}
