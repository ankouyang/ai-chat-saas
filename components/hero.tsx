import Link from "next/link";

const highlights = [
  "先把聊天产品的 UI 骨架做得像样",
  "为历史会话、流式响应和鉴权预留结构",
  "后续可继续扩展计费、团队和工作流能力",
];

export function Hero() {
  return (
    <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-18">
      <div className="space-y-7">
        <p className="section-label">AI Chat SaaS / 第一天</p>
        <div className="space-y-5">
          <h1 className="max-w-4xl font-[family-name:var(--font-display)] text-6xl leading-[0.94] md:text-8xl">
            你的 AI 工作台，应该像产品，而不是玩具 Demo。
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-[var(--color-paper)]/74 md:text-xl">
            先把一个干净的 AI 聊天壳子搭起来，再逐步叠加鉴权、历史记录、模型流式输出和免费额度限制，把它做成真正能承载业务的产品界面。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link className="paper-button" href="/chat">
            打开演示对话
          </Link>
          <Link className="subtle-link" href="/sign-in">
            进入工作区
          </Link>
        </div>
      </div>

      <div className="relative">
        <div className="absolute -left-6 top-10 hidden h-24 w-24 rounded-full bg-[var(--color-rust)]/20 blur-2xl md:block" />
        <div className="panel relative overflow-hidden p-5 md:p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-rust)]/70 to-transparent" />
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-ink)]/10 pb-4">
            <div>
              <p className="section-label text-[var(--color-rust)]">
                工作区预览
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
                产品文案实验台
              </h2>
            </div>
            <div className="rounded-full border border-[var(--color-ink)]/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)]/52">
              静态原型
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {highlights.map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-[var(--color-ink)]/10 bg-[var(--color-paper)]/72 px-4 py-4 text-sm leading-6 text-[var(--color-ink)]/75"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[26px] bg-[var(--color-ink)] px-5 py-5 text-[var(--color-paper)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-paper)]/50">
              示例提问
            </p>
            <p className="mt-3 font-[family-name:var(--font-serif)] text-xl leading-8">
              帮我给一个 AI 产品写首页 Hero，它能帮助创业者把零散笔记整理成可以直接上线的文案。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
