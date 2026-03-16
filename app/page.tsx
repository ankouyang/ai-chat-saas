import Link from "next/link";

import { Hero } from "@/components/hero";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(193,102,55,0.16),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(27,54,93,0.18),_transparent_22%),var(--color-ink)] text-[var(--color-paper)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[var(--color-paper)]/10 pb-5">
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-[0.18em] uppercase">
              灵感工位
            </p>
            <p className="mt-1 text-sm text-[var(--color-paper)]/60">
              面向真实产品工作的 AI 协作空间。
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link className="subtle-link" href="/sign-in">
              登录
            </Link>
            <Link className="ink-button" href="/chat">
              进入演示对话
            </Link>
          </nav>
        </header>

        <Hero />

        <section className="grid gap-4 border-t border-[var(--color-paper)]/10 pt-6 text-sm text-[var(--color-paper)]/70 md:grid-cols-3">
          <div>
            <p className="section-label">Built for</p>
            <p className="mt-2 text-base text-[var(--color-paper)]">
              适合独立开发者、产品操盘手和希望快速落地想法的创作者。
            </p>
          </div>
          <div>
            <p className="section-label">第一天重点</p>
            <p className="mt-2 text-base text-[var(--color-paper)]">
              搭好首页、登录页、聊天页骨架，并先做出产品感。
            </p>
          </div>
          <div>
            <p className="section-label">下一步</p>
            <p className="mt-2 text-base text-[var(--color-paper)]">
              接入鉴权、数据库、流式响应和历史会话。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
