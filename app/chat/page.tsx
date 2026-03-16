import { AppSidebar } from "@/components/app-sidebar";
import { ChatInput } from "@/components/chat-input";
import { ChatMessage } from "@/components/chat-message";
import { SetupNotice } from "@/components/setup-notice";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

type ChatPageProps = {
  searchParams?: Promise<{
    chatId?: string | string[];
  }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const isConfigured = Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);
  const session = isConfigured ? await auth() : null;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const chatIdParam = resolvedSearchParams?.chatId;
  const activeChatId = Array.isArray(chatIdParam) ? chatIdParam[0] : chatIdParam;

  if (isConfigured && !session?.user) {
    redirect("/sign-in");
  }

  const chats =
    isConfigured && session?.user?.id
      ? await prisma.chat.findMany({
          where: {
            userId: session.user.id,
          },
          orderBy: {
            updatedAt: "desc",
          },
          select: {
            id: true,
            title: true,
          },
        })
      : [];

  const activeChat =
    isConfigured && session?.user?.id && activeChatId
      ? await prisma.chat.findFirst({
          where: {
            id: activeChatId,
            userId: session.user.id,
          },
          select: {
            id: true,
            title: true,
            messages: {
              orderBy: {
                createdAt: "asc",
              },
              select: {
                id: true,
                role: true,
                content: true,
              },
            },
          },
        })
      : null;

  if (isConfigured && activeChatId && !activeChat) {
    redirect("/chat");
  }

  console.log("activeChat", activeChat);
  const welcomeTitle = activeChat?.title ?? "今天想把什么真正做出来？";
  const messages = activeChat?.messages ?? [];

  return (
    <main className="min-h-screen bg-[var(--color-stone)] text-[var(--color-ink)]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <AppSidebar chats={chats} activeChatId={activeChat?.id} />

        <section className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-[var(--color-ink)]/10 px-6 py-5 lg:px-8">
            <div>
              <p className="section-label text-[var(--color-rust)]">
                工作区
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                {session?.user?.name ? `${session.user.name} 的产品文案冲刺` : "产品文案冲刺"}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-full border border-[var(--color-ink)]/10 bg-white/80 px-4 py-2 text-sm text-[var(--color-ink)]/70">
                GPT-4.1 风格模型
              </div>
              {session?.user ? <SignOutButton /> : null}
            </div>
          </header>

          <div className="flex-1 px-6 py-6 lg:px-8">
            <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
              {!isConfigured ? <SetupNotice /> : null}

              <div className="mb-6 rounded-[28px] border border-[var(--color-ink)]/10 bg-white/70 p-5 shadow-[0_25px_80px_rgba(38,30,24,0.08)] backdrop-blur">
                <p className="section-label text-[var(--color-rust)]">今天</p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                  {welcomeTitle}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-ink)]/68">
                  {isConfigured
                    ? activeChat
                      ? "这已经是 Day 2 后半段的真实数据页面了。你发送的消息会先写进数据库，再显示在当前会话里。"
                      : "现在可以直接发送第一条消息。系统会自动创建一条 Chat 记录，并把消息保存到数据库。"
                    : "页面结构已经准备好接入真实登录。下一步先配置数据库和认证密钥，再执行 Prisma 初始化。"}
                </p>
              </div>

              <div className="flex-1 space-y-4">
                {messages.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-[var(--color-ink)]/18 bg-white/55 px-5 py-8 text-sm leading-7 text-[var(--color-ink)]/60">
                    当前还没有消息。你可以直接在下方输入一段需求，系统会自动创建会话、保存用户消息，并写入一条演示用助手回复。
                  </div>
                ) : null}
                {messages.map((message) => {
                  const role = message.role === "user" ? "user" : "assistant";

                  return (
                    <ChatMessage
                      key={message.id}
                      role={role}
                      title={role === "user" ? "你" : "灵感工位"}
                      body={message.content}
                    />
                  );
                })}
              </div>

              <ChatInput chatId={activeChat?.id} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
