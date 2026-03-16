import Link from "next/link";

type AuthStatusCardProps = {
  configured: boolean;
};

export function AuthStatusCard({ configured }: AuthStatusCardProps) {
  if (configured) {
    return (
      <div className="rounded-[24px] border border-emerald-700/20 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-950">
        Day 2 已接入真实登录骨架。提交表单后，会通过 Auth.js 创建或复用数据库中的用户。
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-[var(--color-rust)]/15 bg-[var(--color-rust)]/8 px-4 py-4 text-sm leading-6 text-[var(--color-ink)]/78">
      还没配置数据库和认证密钥。先创建 <code>.env</code>，填好
      <code>DATABASE_URL</code> 和 <code>AUTH_SECRET</code>，再执行 Prisma
      初始化。
      <Link className="subtle-link ml-2 inline-flex" href="/chat">
        查看聊天页当前状态
      </Link>
    </div>
  );
}
