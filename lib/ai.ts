import { logChatTrace, logChatTraceError } from "@/lib/chat-trace";
import { listRecentChatMessages } from "@/lib/message-cache";

type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ModelRequestErrorCode =
  | "timeout"
  | "network"
  | "http_4xx"
  | "http_5xx"
  | "empty_response"
  | "stream_unreadable";

const SYSTEM_PROMPT =
  "你是一个帮助独立开发者和产品创作者推进工作的 AI 助手。回答要具体、结构清楚、少空话，优先给出可执行建议。";
const DEFAULT_OPENAI_TIMEOUT_MS = 30_000;

class ModelRequestError extends Error {
  code: ModelRequestErrorCode;
  status?: number;
  model?: string;
  requestUrl?: string;

  constructor(
    message: string,
    options: {
      code: ModelRequestErrorCode;
      status?: number;
      model?: string;
      requestUrl?: string;
    },
  ) {
    super(message);
    this.name = "ModelRequestError";
    this.code = options.code;
    this.status = options.status;
    this.model = options.model;
    this.requestUrl = options.requestUrl;
  }
}

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

function resolveOpenAiTimeoutMs() {
  const raw = process.env.OPENAI_TIMEOUT_MS?.trim();
  const timeoutMs = raw ? Number(raw) : DEFAULT_OPENAI_TIMEOUT_MS;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_OPENAI_TIMEOUT_MS;
  }

  return timeoutMs;
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

export function getModelErrorMessage(error: unknown) {
  if (error instanceof ModelRequestError) {
    switch (error.code) {
      case "timeout":
        return "模型响应超时，请稍后重试。";
      case "network":
        return "模型网络连接失败，请稍后重试。";
      case "http_4xx":
        return "模型请求参数异常，请检查模型配置。";
      case "http_5xx":
        return "模型服务暂时不可用，请稍后重试。";
      case "empty_response":
        return "模型没有返回有效内容，请稍后再试。";
      case "stream_unreadable":
        return "模型返回了流式响应，但响应体不可读。";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "模型调用失败，请稍后再试。";
}

async function readStreamingChatCompletion(
  response: Response,
  context: {
    chatId: string;
    model: string;
    traceId?: string;
  },
  onChunk?: (chunk: string) => void,
) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new ModelRequestError("模型开启流式返回，但响应体不可读。", {
      code: "stream_unreadable",
      model: context.model,
    });
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let assistantContent = "";
  let chunkCount = 0;

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
        chunkCount += 1;
        onChunk?.(delta);
        // 模型不要随便去掉下面这个打印日志
        console.log("[model.stream.chunk]", delta);
      } catch (error) {
        logChatTraceError("model.stream.parse_failed", {
          traceId: context.traceId,
          chatId: context.chatId,
          model: context.model,
          payload,
          error,
        });
      }
    }
  }

  const normalized = assistantContent.trim();

  logChatTrace("model.stream.complete", {
    traceId: context.traceId,
    chatId: context.chatId,
    model: context.model,
    chunkCount,
    contentLength: normalized.length,
  });

  if (!normalized) {
    throw new ModelRequestError("模型没有返回有效内容。", {
      code: "empty_response",
      model: context.model,
    });
  }

  return normalized;
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
  timeoutMs,
}: {
  requestUrl: string;
  apiKey: string;
  model: string;
  messages: ModelMessage[];
  streamLog: boolean;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(requestUrl, {
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
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelRequestError(`模型请求超时，超过 ${timeoutMs}ms。`, {
        code: "timeout",
        model,
        requestUrl,
      });
    }

    throw new ModelRequestError("模型网络请求失败。", {
      code: "network",
      model,
      requestUrl,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateChatReplyInternal({
  chatId,
  stream,
  onChunk,
  traceId,
}: {
  chatId: string;
  stream: boolean;
  onChunk?: (chunk: string) => void;
  traceId?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return "当前还没有配置 OPENAI_API_KEY，所以这里只能先停在数据库闭环。配置好模型 Key 后，这里会返回真实模型回复。";
  }

  const history = await listRecentChatMessages(chatId, 12, {
    source: "model",
    traceId,
  });

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
  const timeoutMs = resolveOpenAiTimeoutMs();
  const modelCandidates = resolveModelCandidates();
  const requestLogUrl = sanitizeBaseUrlForLog(requestUrl);

  logChatTrace("model.request.start", {
    traceId,
    requestUrl: requestLogUrl,
    modelCandidates,
    chatId,
    messageCount: messages.length,
    stream,
    streamLog,
    timeoutMs,
  });

  let lastError: Error | null = null;

  for (const [index, model] of modelCandidates.entries()) {
    logChatTrace("model.request.attempt", {
      traceId,
      chatId,
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
      timeoutMs,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const debugContext = {
        status: response.status,
        requestUrl: requestLogUrl,
        model,
        messageCount: messages.length,
      };

      logChatTraceError("model.request.failed", {
        traceId,
        chatId,
        ...debugContext,
        errorText,
      });

      lastError = new ModelRequestError(
        `模型调用失败: ${response.status} ${errorText} | requestUrl=${debugContext.requestUrl} | model=${model}`,
        {
          code: response.status >= 500 ? "http_5xx" : "http_4xx",
          status: response.status,
          model,
          requestUrl: debugContext.requestUrl,
        },
      );

      if (
        index < modelCandidates.length - 1 &&
        shouldRetryWithNextModel(response.status, errorText)
      ) {
        logChatTrace("model.request.retry_next_model", {
          traceId,
          chatId,
          failedModel: model,
          nextModel: modelCandidates[index + 1],
        });
        continue;
      }

      throw lastError;
    }

    if (stream) {
      return readStreamingChatCompletion(
        response,
        {
          traceId,
          chatId,
          model,
        },
        onChunk,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const assistantContent = extractAssistantContent(data);

    if (!assistantContent.trim()) {
      throw new ModelRequestError("模型没有返回有效内容。", {
        code: "empty_response",
        model,
        requestUrl: requestLogUrl,
      });
    }

    logChatTrace("model.reply.complete", {
      traceId,
      chatId,
      model,
      contentLength: assistantContent.length,
    });

    return assistantContent;
  }

  throw lastError ?? new Error("模型调用失败：未能拿到有效响应。");
}

export async function generateChatReply(chatId: string, traceId?: string) {
  return generateChatReplyInternal({
    chatId,
    stream: shouldStreamLog(),
    traceId,
  });
}

export async function generateChatReplyStream(
  chatId: string,
  onChunk: (chunk: string) => void,
  traceId?: string,
) {
  return generateChatReplyInternal({
    chatId,
    stream: true,
    onChunk,
    traceId,
  });
}
