"use client";

import { Component } from "react";
import { ButtonLink } from "@/components/ui";

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : "未知错误" };
  }

  componentDidCatch(error: unknown) {
    // 不打印任何敏感信息；仅记录稳定错误消息（不含密钥/连接串）
    console.error("[pf] render error:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-danger" role="alert">页面渲染失败</p>
          <p className="text-base font-medium text-ink">发生了未预期的错误</p>
          <p className="max-w-sm text-sm text-ink-2">请刷新页面重试；如持续出现，请反馈给演示维护方。</p>
          <div className="mt-2 flex gap-2">
            <ButtonLink href="/home" variant="secondary">返回首页</ButtonLink>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="h-11 min-w-[44px] rounded-md px-4 text-sm text-ink-2 hover:bg-subtle hover:text-ink"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
