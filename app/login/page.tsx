"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button, Field, Input, Divider } from "@/components/ui";
import { DemoTag, OfflineState } from "@/components/states";
import { ALL_ROLES, roleLabel, roleDescription } from "@/lib/demo";
import { mockFetch } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { login as apiLogin } from "@/lib/api/auth";
import type { Role } from "@/lib/types";

function sanitizeReturnTo(raw: string | null): string {
  if (!raw) return "/home";
  if (!raw.startsWith("/")) return "/home";
  if (raw.startsWith("//")) return "/home";
  if (raw.startsWith("/login") || raw.startsWith("/register")) return "/home";
  return raw;
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = sanitizeReturnTo(params.get("returnTo"));

  const setRole = useAppStore((s) => s.setRole);
  const signIn = useAppStore((s) => s.signIn);
  const pushToast = useAppStore((s) => s.pushToast);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const demoState = useAppStore((s) => s.demoState);

  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace(returnTo);
  }, [isAuthenticated, router, returnTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (demoState === "offline") {
      setError("当前离线演示，无法登录；恢复网络后可重试。");
      return;
    }
    if (!identity.trim()) {
      setError("请输入邮箱或用户名。");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位。");
      return;
    }
    setLoading(true);
    try {
      if (isApiMode) {
        const profile = await apiLogin({ email: identity.trim(), password });
        signIn(profile);
      } else {
        await mockFetch({ ok: true }, { latency: [600, 900] });
        setRole("new_learner");
      }
      pushToast("登录成功，欢迎回来", "success");
      router.replace(returnTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时无法登录，请检查网络后重试。");
      setLoading(false);
    }
  }

  function quickEnter(role: Role) {
    if (demoState === "offline") {
      pushToast("当前离线演示，无法切换角色", "error");
      return;
    }
    setRole(role);
    pushToast("已以演示身份进入", "success");
    router.replace(returnTo);
  }

  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[minmax(280px,1fr)_minmax(0,1.4fr)]">
      {/* 左侧品牌区 */}
      <aside className="hidden flex-col justify-between bg-ink p-8 text-white md:flex">
        <div>
          <p className="text-lg font-semibold tracking-tight">知径 Pathfinder</p>
          <p className="mt-1 text-sm text-white/70">可信学习路径</p>
        </div>
        <ul className="space-y-3 text-sm text-white/80">
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>教材锚定：不按热点堆课
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>来源可解释：A/B/C 分级证据
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>费曼验证：讲给 AI 听
          </li>
        </ul>
        <Link href="/" className="inline-flex h-11 items-center text-sm text-white/70 hover:text-white">
          ← 返回首页
        </Link>
      </aside>

      {/* 右侧表单 */}
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <Link href="/" className="text-sm font-semibold text-ink">
              知径 Pathfinder
            </Link>
            <DemoTag />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">欢迎回来</h1>
          <p className="mt-1 text-sm text-ink-2">登录后继续你的学习路径。</p>

          {demoState === "offline" ? (
            <div className="mt-4">
              <OfflineState />
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="邮箱或用户名" htmlFor="login-identity" error={error}>
              <Input
                id="login-identity"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                disabled={loading}
              />
            </Field>
            <Field label="密码" htmlFor="login-password">
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                  autoComplete="current-password"
                  disabled={loading}
                  className="pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute inset-y-0 right-0 flex h-full items-center px-3 text-xs text-ink-2 hover:text-ink"
                  aria-label={showPwd ? "隐藏密码" : "显示密码"}
                >
                  {showPwd ? "隐藏" : "显示"}
                </button>
              </div>
            </Field>

            <Button type="submit" className="w-full" loading={loading}>
              {loading ? "正在安全登录" : "登录"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-ink-2">
            没有账号？
            <Link
              href={`/register${returnTo !== "/home" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
              className="ml-1 font-medium text-ink underline-offset-2 hover:underline"
            >
              创建账号
            </Link>
          </p>
          <p className="mt-1 text-xs text-ink-3">
            {isApiMode
              ? "真实数据模式：登录将建立安全会话，密码只提交到后端校验。"
              : "演示登录不会发送真实请求，密码不会被记录或上传。"}
          </p>

          {isApiMode ? null : <Divider className="my-6" />}

          {isApiMode ? null : <div className="rounded-md border border-line bg-subtle/50 p-4">
            <p className="text-sm font-medium text-ink">
              以演示角色快速进入
              <span className="ml-2">
                <DemoTag />
              </span>
            </p>
            <p className="mt-1 text-xs text-ink-3">点击后直接以该演示身份进入，无需输入密码。</p>
            <div className="mt-3 grid gap-2">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => quickEnter(role)}
                  disabled={loading}
                  className="flex min-h-[44px] items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-ink-2 hover:bg-subtle disabled:opacity-50"
                >
                  <span>
                    <span className="block text-sm font-medium text-ink">{roleLabel(role)}</span>
                    <span className="block text-xs text-ink-3">{roleDescription(role)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-2">进入 →</span>
                </button>
              ))}
            </div>
          </div>
          }
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
