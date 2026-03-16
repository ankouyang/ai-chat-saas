import Link from "next/link";

import { AuthStatusCard } from "@/components/auth-status-card";
import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  const isConfigured = Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);

  return (
    <main className="min-h-screen bg-[var(--color-sand)] px-6 py-8 text-[var(--color-ink)] lg:px-10">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-2xl tracking-[0.16em] uppercase"
          >
            灵感工位
          </Link>
          <Link className="subtle-link text-[var(--color-ink)]" href="/chat">
            直接查看演示
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <p className="section-label text-[var(--color-rust)]">登录</p>
            <h1 className="max-w-xl font-[family-name:var(--font-display)] text-5xl leading-none md:text-7xl">
              回到你的 AI 工作台。
            </h1>
            <p className="max-w-lg text-lg leading-8 text-[var(--color-ink)]/72">
              流程先保持简单：登录、接续历史对话，把零散灵感推进成真正可上线的内容。
            </p>
            <div className="flex gap-8 text-sm text-[var(--color-ink)]/65">
              <p>共享提示词</p>
              <p>保存会话</p>
              <p>额度感知工作流</p>
            </div>
          </div>

          <div className="panel p-7 md:p-9">
            <div className="space-y-2">
              <p className="section-label text-[var(--color-rust)]">继续</p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl">
                登录账号
              </h2>
              <p className="text-sm leading-6 text-[var(--color-ink)]/65">
                现在已经接上 Day 2 的登录骨架，提交后会走 Auth.js。
              </p>
            </div>

            <div className="mt-6">
              <AuthStatusCard configured={isConfigured} />
            </div>

            <SignInForm configured={isConfigured} />

            <p className="mt-5 text-sm text-[var(--color-ink)]/60">
              Day 2 为了专注搭流程，先做开发者友好的邮箱直登方案，不做密码和邮箱验证码。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
