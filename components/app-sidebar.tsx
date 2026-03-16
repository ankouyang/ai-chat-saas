import Link from "next/link";
import { createChatAction } from "@/app/chat/actions";

type SidebarChat = {
  id: string;
  title: string;
};

type AppSidebarProps = {
  chats: SidebarChat[];
  activeChatId?: string;
};

export function AppSidebar({ chats, activeChatId }: AppSidebarProps) {
  return (
    <aside className="flex min-h-screen flex-col border-r border-[var(--color-ink)]/10 bg-[var(--color-ink)] px-5 py-6 text-[var(--color-paper)]">
      <div>
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-[0.14em] uppercase">
          灵感工位
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-paper)]/60">
          一个为独立开发者准备的 AI 工作台，把草稿推进成可上线成果。
        </p>
      </div>

      <form action={createChatAction}>
        <button
          className="paper-button mt-8 w-full justify-center text-[var(--color-ink)]"
          type="submit"
        >
          新建对话
        </button>
      </form>

      <div className="mt-8">
        <p className="section-label text-[var(--color-paper)]/45">最近会话</p>
        <div className="mt-3 space-y-2">
          {chats.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-paper)]/10 px-4 py-4 text-sm leading-6 text-[var(--color-paper)]/50">
              你还没有历史会话。点击上方按钮，或者直接在右侧输入第一条消息。
            </div>
          ) : null}
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat?chatId=${chat.id}`}
              className={`block w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                activeChatId === chat.id
                  ? "bg-[var(--color-paper)]/10 text-[var(--color-paper)]"
                  : "text-[var(--color-paper)]/62 hover:bg-[var(--color-paper)]/7 hover:text-[var(--color-paper)]"
              }`}
            >
              {chat.title}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-[26px] border border-[var(--color-paper)]/10 bg-[var(--color-paper)]/6 p-4">
        <p className="section-label text-[var(--color-paper)]/45">免费计划</p>
        <p className="mt-3 text-sm leading-6 text-[var(--color-paper)]/70">
          本周还剩 14 次提问额度。Day 5 我们会把这里接成真正的额度限制。
        </p>
        <Link className="subtle-link mt-4 inline-flex text-[var(--color-paper)]" href="/">
          返回首页
        </Link>
      </div>
    </aside>
  );
}
