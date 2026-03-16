import { sendMessageAction } from "@/app/chat/actions";

type ChatInputProps = {
  chatId?: string;
};

export function ChatInput({ chatId }: ChatInputProps) {
  return (
    <form
      action={sendMessageAction}
      className="mt-6 rounded-[30px] border border-[var(--color-ink)]/10 bg-white p-3 shadow-[0_25px_70px_rgba(38,30,24,0.08)]"
    >
      <input type="hidden" name="chatId" value={chatId ?? ""} />
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <textarea
            name="content"
            className="min-h-28 w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-7 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink)]/35"
            placeholder="可以让它帮你写标题、改文案、拆计划，或者把一个模糊想法整理清楚。"
          />
        </label>
        <button
          className="ink-button shrink-0 justify-center md:min-w-36"
          type="submit"
        >
          发送
        </button>
      </div>
    </form>
  );
}
