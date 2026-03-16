import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "灵感工位",
  description: "一个用 Next.js 搭建的 AI 聊天工作台原型。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
