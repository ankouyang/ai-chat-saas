import Link from "next/link";

export function SetupNotice() {
  return (
    <div className="mx-auto w-full max-w-3xl rounded-[28px] border border-[var(--color-rust)]/20 bg-white/80 p-6 shadow-[0_25px_80px_rgba(38,30,24,0.08)]">
      <p className="section-label text-[var(--color-rust)]">Day 2 状态</p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
        聊天页已切到受保护模式
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--color-ink)]/72">
        现在这页的访问逻辑已经准备好接入真实登录，但你还没有配置
        PostgreSQL 和 Auth Secret，所以先显示说明面板，而不是直接放行真实聊天。
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="ink-button" href="/sign-in">
          去登录页
        </Link>
        <Link className="subtle-link" href="/">
          返回首页
        </Link>
      </div>
      <div className="mt-6 rounded-[20px] bg-[var(--color-ink)] px-4 py-4 font-mono text-sm leading-7 text-[var(--color-paper)]/88">
        <p>DATABASE_URL=&quot;postgresql://USER:PASSWORD@HOST:5432/DB&quot;</p>
        <p>AUTH_SECRET=&quot;replace-with-a-long-random-string&quot;</p>
      </div>
    </div>
  );
}
