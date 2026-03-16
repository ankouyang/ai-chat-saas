"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      className="subtle-link text-[var(--color-ink)]"
      type="button"
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
    >
      退出登录
    </button>
  );
}
