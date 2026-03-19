export function createTraceId() {
  return crypto.randomUUID().slice(0, 8);
}

export function logChatTrace(
  event: string,
  metadata: Record<string, unknown>,
) {
  console.log(`[chat.trace] ${event}`, metadata);
}

export function logChatTraceError(
  event: string,
  metadata: Record<string, unknown>,
) {
  console.error(`[chat.trace] ${event}`, metadata);
}
