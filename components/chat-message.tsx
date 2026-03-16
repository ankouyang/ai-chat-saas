type ChatMessageProps = {
  role: "user" | "assistant";
  title: string;
  body: string;
};

export function ChatMessage({ role, title, body }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <article
      className={`rounded-[28px] border px-5 py-5 shadow-[0_18px_50px_rgba(38,30,24,0.06)] ${
        isUser
          ? "ml-auto max-w-2xl border-[var(--color-rust)]/20 bg-[var(--color-rust)]/10"
          : "max-w-3xl border-[var(--color-ink)]/10 bg-white/78"
      }`}
    >
      <p className="section-label text-[var(--color-rust)]">{title}</p>
      <p className="mt-3 text-[15px] leading-8 text-[var(--color-ink)]/78">
        {body}
      </p>
    </article>
  );
}
