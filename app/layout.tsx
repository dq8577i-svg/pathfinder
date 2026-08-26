import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/shell";
import { ToastViewport } from "@/components/overlay";
import { PrototypeConsole } from "@/components/prototype-console";
import { ErrorBoundary } from "@/components/error-boundary";

export const metadata: Metadata = {
  title: "知径 Pathfinder · AI 学习路径工作台（Web 演示）",
  description:
    "可信教材能力骨架 + AI 编排 + 可解释公开资料证据 + 费曼追问 + 可恢复学习资产。本演示为前端 Mock 实现，所有 AI 内容标注「AI 整理（演示）」，所有数据为演示数据。",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-canvas">
        <ErrorBoundary>
          <AppProvider>
            <AppShell>{children}</AppShell>
            <ToastViewport />
            <PrototypeConsole />
          </AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
