import { listRecentChatMessages } from "@/lib/message-cache";

type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT =
  "你是一个帮助独立开发者和产品创作者推进工作的 AI 助手。回答要具体、结构清楚、少空话，优先给出可执行建议。";

function resolveBaseUrl() {
  const raw = process.env.OPENAI_BASE_URL?.trim();

  if (!raw) {
    return "https://api.openai.com/v1";
  }

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function resolveModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

function resolveModelCandidates() {
  const primary = resolveModel();
  const fallbacks =
    process.env.OPENAI_MODEL_FALLBACKS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  return [...new Set([primary, ...fallbacks])];
}

function shouldStreamLog() {
  const value = process.env.OPENAI_STREAM_LOG?.trim()?.toLowerCase();

  return value === "1" || value === "true" || value === "yes";
}

function sanitizeBaseUrlForLog(baseUrl: string) {
  try {
    const url = new URL(baseUrl);

    return `${url.origin}${url.pathname}`;
  } catch {
    return baseUrl;
  }
}

function mapRole(role: string): ModelMessage["role"] {
  if (role === "assistant" || role === "system") {
    return role;
  }

  return "user";
}

function extractAssistantContent(data: {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}) {
  return (
    data.choices?.[0]?.message?.content?.trim() ||
    "模型没有返回有效内容，请稍后再试。"
  );
}

async function readStreamingChatCompletion(
  response: Response,
  onChunk?: (chunk: string) => void,
) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("模型开启流式返回，但响应体不可读。");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let assistantContent = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line || !line.startsWith("data:")) {
        continue;
      }

      const payload = line.slice(5).trim();

      if (payload === "[DONE]") {
        continue;
      }

      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string;
            };
          }>;
        };
        const delta = chunk.choices?.[0]?.delta?.content ?? "";

        if (!delta) {
          continue;
        }

        assistantContent += delta;
        onChunk?.(delta);
        console.log("[model.stream.chunk]", delta);
      } catch (error) {
        console.error("[model.stream.parse_failed]", {
          payload,
          error,
        });
      }
    }
  }

  const normalized = assistantContent.trim();

  console.log("[model.reply.complete]", normalized);

  return normalized || "模型没有返回有效内容，请稍后再试。";
}

function shouldRetryWithNextModel(status: number, errorText: string) {
  if (status !== 404 && status !== 400) {
    return false;
  }

  const normalized = errorText.toLowerCase();

  return (
    normalized.includes("deploymentnotfound") ||
    normalized.includes("model_not_found") ||
    normalized.includes("does not exist") ||
    normalized.includes("invalid model")
  );
}

async function requestChatCompletion({
  requestUrl,
  apiKey,
  model,
  messages,
  streamLog,
}: {
  requestUrl: string;
  apiKey: string;
  model: string;
  messages: ModelMessage[];
  streamLog: boolean;
}) {
  return fetch(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages,
      stream: streamLog,
    }),
    cache: "no-store",
  });
}

async function generateChatReplyInternal({
  chatId,
  stream,
  onChunk,
}: {
  chatId: string;
  stream: boolean;
  onChunk?: (chunk: string) => void;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return "当前还没有配置 OPENAI_API_KEY，所以这里只能先停在数据库闭环。配置好模型 Key 后，这里会返回真实模型回复。";
  }

  const history = await listRecentChatMessages(chatId, 12);

  const messages: ModelMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    ...history.map((message) => ({
      role: mapRole(message.role),
      content: message.content,
    })),
  ];

  const baseUrl = resolveBaseUrl();
  const requestUrl = `${baseUrl}/chat/completions`;
  const streamLog = shouldStreamLog();
  const modelCandidates = resolveModelCandidates();
  const requestLogUrl = sanitizeBaseUrlForLog(requestUrl);

  console.log("[model.request.start]", {
    requestUrl: requestLogUrl,
    modelCandidates,
    chatId,
    messageCount: messages.length,
    stream,
    streamLog,
  });

  let lastError: Error | null = null;

  for (const [index, model] of modelCandidates.entries()) {
    console.log("[model.request.attempt]", {
      requestUrl: requestLogUrl,
      model,
      attempt: index + 1,
      totalAttempts: modelCandidates.length,
      stream,
    });

    const response = await requestChatCompletion({
      requestUrl,
      apiKey,
      model,
      messages,
      streamLog: stream,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const debugContext = {
        status: response.status,
        requestUrl: requestLogUrl,
        model,
        messageCount: messages.length,
      };

      console.error("Model request failed", {
        ...debugContext,
        errorText,
      });

      lastError = new Error(
        `模型调用失败: ${response.status} ${errorText} | requestUrl=${debugContext.requestUrl} | model=${model}`,
      );

      if (
        index < modelCandidates.length - 1 &&
        shouldRetryWithNextModel(response.status, errorText)
      ) {
        console.warn("[model.request.retry_next_model]", {
          failedModel: model,
          nextModel: modelCandidates[index + 1],
        });
        continue;
      }

      throw lastError;
    }

    if (stream) {
      return readStreamingChatCompletion(response, onChunk);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const assistantContent = extractAssistantContent(data);

    console.log("[model.reply.complete]", {
      model,
      content: assistantContent,
    });

    return assistantContent;
  }

  throw lastError ?? new Error("模型调用失败：未能拿到有效响应。");
}

export async function generateChatReply(chatId: string) {
  return generateChatReplyInternal({
    chatId,
    stream: shouldStreamLog(),
  });
}

export async function generateChatReplyStream(
  chatId: string,
  onChunk: (chunk: string) => void,
) {
  return generateChatReplyInternal({
    chatId,
    stream: true,
    onChunk,
  });
}
