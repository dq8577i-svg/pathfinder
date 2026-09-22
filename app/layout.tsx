import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/shell";
import { ToastViewport } from "@/components/overlay";
import { PrototypeConsole } from "@/components/prototype-console";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme";

export const metadata: Metadata = {
  title: "知径 Pathfinder · AI 个性化学习路径工作台",
  description:
    "输入任意学习主题，由 AI 编排可解释路径、资料证据与费曼练习，并支持同时管理多条可恢复的学习路径。",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <body className="bg-canvas">
        <ErrorBoundary>
          <ThemeProvider>
            <AppProvider>
              <AppShell>{children}</AppShell>
              <ToastViewport />
              <PrototypeConsole />
            </AppProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
