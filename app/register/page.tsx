"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button, Field, Input, Divider } from "@/components/ui";
import { DemoTag, OfflineState } from "@/components/states";
import { mockFetch } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { register as apiRegister } from "@/lib/api/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function strengthOf(pwd: string): { label: string; tone: string } | null {
  if (pwd.length < 8) return null;
  const classes = [/[a-zA-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(pwd)).length;
  if (classes >= 3) return { label: "强", tone: "text-success" };
  if (classes >= 2) return { label: "合格", tone: "text-warning" };
  return { label: "较弱", tone: "text-ink-3" };
}

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo")?.startsWith("/") && !params.get("returnTo")?.startsWith("//")
    ? params.get("returnTo")!
    : "/onboarding";

  const setRole = useAppStore((s) => s.setRole);
  const signIn = useAppStore((s) => s.signIn);
  const pushToast = useAppStore((s) => s.pushToast);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const demoState = useAppStore((s) => s.demoState);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace(returnTo);
  }, [isAuthenticated, router, returnTo]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 30) next.name = "昵称需为 2–30 个字符。";
    if (!EMAIL_RE.test(email.trim())) next.email = "请输入有效的邮箱地址。";
    if (password.length < 8 || password.length > 72) next.password = "密码需为 8–72 位。";
    if (confirm !== password) next.confirm = "两次输入的密码不一致。";
    if (!agree) next.agree = "请先阅读并同意《服务条款》与《隐私说明》。";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (demoState === "offline") {
      setErrors({ agree: "当前离线演示，无法注册；恢复网络后请重新输入密码提交。" });
      return;
    }
    if (!validate()) return;
    setLoading(true);
    try {
      if (isApiMode) {
        const profile = await apiRegister({ email: email.trim(), password, displayName: name.trim() });
        signIn(profile);
      } else {
        await mockFetch({ ok: true }, { latency: [700, 1000] });
        setRole("new_learner");
      }
      pushToast("账号已创建，开始规划你的学习路径", "success");
      router.push("/onboarding");
    } catch (e) {
      setErrors({ email: e instanceof Error ? e.message : "暂时无法注册，请检查网络后重试。" });
      setLoading(false);
    }
  }

  const strength = strengthOf(password);

  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[minmax(280px,1fr)_minmax(0,1.4fr)]">
      <aside className="hidden flex-col justify-between bg-ink p-8 text-white md:flex">
        <div>
          <p className="text-lg font-semibold tracking-tight">知径 Pathfinder</p>
          <p className="mt-1 text-sm text-white/70">先规划，再学习，再验证</p>
        </div>
        <ul className="space-y-3 text-sm text-white/80">
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>用最少字段开始规划
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>演示环境不会采集敏感信息
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>注册即进入目标诊断
          </li>
        </ul>
        <Link href="/" className="inline-flex h-11 items-center text-sm text-white/70 hover:text-white">
          ← 返回首页
        </Link>
      </aside>

      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <Link href="/" className="text-sm font-semibold text-ink">
              知径 Pathfinder
            </Link>
            <DemoTag />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            创建账号，开始你的学习路径
          </h1>
          <p className="mt-1 text-sm text-ink-2">最少字段即可创建可开始规划的学习者账号。</p>

          {demoState === "offline" ? (
            <div className="mt-4">
              <OfflineState description="当前为离线演示，注册不会创建云端账号，密码不会被持久化。" />
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="昵称" htmlFor="reg-name" error={errors.name}>
              <Input
                id="reg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="林然"
                autoComplete="nickname"
                disabled={loading}
              />
            </Field>
            <Field label="邮箱" htmlFor="reg-email" error={errors.email}>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="linran@example.com"
                autoComplete="email"
                disabled={loading}
              />
            </Field>
            <Field
              label="密码"
              htmlFor="reg-password"
              error={errors.password}
              hint={strength ? `密码强度：${strength.label}` : undefined}
            >
              <div className="relative">
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位，含两类字符"
                  autoComplete="new-password"
                  disabled={loading}
                  className="pr-16"
                />
                <span
                  className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium ${strength?.tone ?? "text-ink-3"}`}
                >
                  {strength ? strength.label : ""}
                </span>
              </div>
            </Field>
            <Field label="确认密码" htmlFor="reg-confirm" error={errors.confirm}>
              <Input
                id="reg-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
                disabled={loading}
              />
            </Field>

            <div className="flex items-start gap-2">
              <input
                id="reg-agree"
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                disabled={loading}
                className="mt-1 h-5 w-5 rounded border-line accent-[#18181b]"
                aria-describedby="reg-agree-error"
              />
              <label htmlFor="reg-agree" className="text-sm text-ink-2">
                我已阅读并同意
                <a href="#terms" className="mx-0.5 font-medium text-ink underline-offset-2 hover:underline">
                  《服务条款》
                </a>
                和
                <a href="#terms" className="mx-0.5 font-medium text-ink underline-offset-2 hover:underline">
                  《隐私说明》
                </a>
              </label>
            </div>
            {errors.agree ? (
              <p id="reg-agree-error" className="text-xs text-danger" role="alert">
                {errors.agree}
              </p>
            ) : null}

            <Button type="submit" className="w-full" loading={loading}>
              {loading ? "正在创建账号" : "创建并开始规划"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-ink-2">
            已有账号？
            <Link
              href={`/login?returnTo=${encodeURIComponent("/onboarding")}`}
              className="ml-1 font-medium text-ink underline-offset-2 hover:underline"
            >
              登录
            </Link>
          </p>
          <p className="mt-1 text-xs text-ink-3">
            {isApiMode
              ? "真实数据模式：注册将创建云端账号并建立安全会话，密码仅存后端哈希。"
              : "演示注册为纯前端模拟，不写入真实账号；密码仅作前端校验，不会被记录或上传。"}
          </p>

          {isApiMode ? null : <Divider className="my-6" />}

          {isApiMode ? null : (
            <div className="text-xs text-ink-3">
              <DemoTag /> 所有数据均为演示数据；AI 内容标注「AI 整理（演示）」。
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
