"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

type SignInFormProps = {
  configured: boolean;
};

export function SignInForm({ configured }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!configured) {
      setError("请先配置 DATABASE_URL 和 AUTH_SECRET。");
      return;
    }

    if (!email.trim()) {
      setError("请先填写邮箱地址。");
      return;
    }

    setSubmitting(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      name,
      callbackUrl: "/chat",
      redirect: false,
    });

    setSubmitting(false);

    if (result?.error) {
      setError("登录失败，请先检查数据库连接和环境变量。");
      return;
    }

    window.location.href = "/chat";
  }

  return (
    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="text-sm font-medium">邮箱地址</span>
        <input
          className="form-input"
          type="email"
          placeholder="name@company.com"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">你的昵称</span>
        <input
          className="form-input"
          type="text"
          placeholder="安口"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      {error ? (
        <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        className="ink-button mt-3 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={submitting}
      >
        {submitting ? "登录中..." : "继续"}
      </button>
    </form>
  );
}
