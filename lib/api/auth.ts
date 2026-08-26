/**
 * 知径 Pathfinder — 认证 API 客户端（M7）
 *
 * 后端 PublicUser 字段 → 前端 UserProfile 的适配。登录/注册成功后服务端
 * 已通过 HttpOnly Cookie（pf_session）建立会话，此处只负责读取返回的用户画像。
 */
import { api, apiOrNull } from "./client";
import type { UserProfile } from "@/lib/types";

/** 后端 /auth/me 返回的用户画像（不含 password_hash） */
interface PublicUser {
  id: string;
  email: string | null;
  displayName: string;
  role: string;
  weeklyHours: number;
  goalSummary: string | null;
  avatarUrl: string | null;
  hasPath: boolean;
  isDemo: boolean;
}

function toProfile(p: PublicUser): UserProfile {
  return {
    id: p.id,
    role: p.role as UserProfile["role"],
    displayName: p.displayName,
    email: p.email ?? "",
    weeklyHours: p.weeklyHours,
    goalSummary: p.goalSummary ?? "",
    hasPath: p.hasPath,
    isDemo: p.isDemo,
  };
}

export async function register(input: { email: string; password: string; displayName: string }): Promise<UserProfile> {
  const d = await api<{ user: PublicUser }>("/auth/register", { method: "POST", body: input });
  return toProfile(d.user);
}

export async function login(input: { email: string; password: string }): Promise<UserProfile> {
  const d = await api<{ user: PublicUser }>("/auth/login", { method: "POST", body: input });
  return toProfile(d.user);
}

export async function logout(): Promise<void> {
  await api<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

/** 读取当前会话用户；未登录（401）→ null，供刷新恢复 / 路由守卫 */
export async function me(): Promise<UserProfile | null> {
  const d = await apiOrNull<{ user: PublicUser }>("/auth/me");
  return d ? toProfile(d.user) : null;
}
