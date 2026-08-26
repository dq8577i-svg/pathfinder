/**
 * AppStore：角色、鉴权、功能开关、演示状态、Toast 的全局单例。
 * 零依赖实现（useSyncExternalStore），API 与 zustand 的 useAppStore(selector) 一致。
 *
 * 演示状态驱动：
 *  - URL query：?role=learner&state=offline&flag=crews
 *  - 隐藏原型控制台（页面左下角「···」）
 *  - 浏览器 localStorage 持久化角色/开关/演示态（key: pf-store-v1）
 */
"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { DemoState, Flag, Role, UserProfile } from "@/lib/types";
import { ALL_FLAGS, FLAG_DEFAULTS } from "@/lib/types";
import { profileFor } from "@/lib/demo";
import { isApiMode } from "@/lib/data-source";
import { logout as apiLogout, me as apiMe } from "@/lib/api/auth";

const STORAGE_KEY = "pf-store-v1";
const VALID_ROLES: Role[] = ["guest", "new_learner", "learner", "practice_learner", "content_admin", "org_admin"];
const VALID_STATES: DemoState[] = ["normal", "offline", "ai_error", "evidence_insufficient", "empty", "forbidden"];

export type ToastType = "success" | "error" | "warning" | "info";
export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export interface AppState {
  role: Role;
  profile: UserProfile;
  isAuthenticated: boolean;
  /** api 模式下真实会话用户（demo 模式恒为 null） */
  realUser: UserProfile | null;
  flags: Record<Flag, boolean>;
  demoState: DemoState;
  authReturnTo: string | null;
  toasts: Toast[];
  consoleOpen: boolean;
  /** 客户端水合完成（demo: localStorage+URL；api: /auth/me 会话恢复完成）后为 true；此前守卫不做重定向 */
  hydrated: boolean;
  setConsoleOpen: (open: boolean) => void;
  login: (role: Role, returnTo?: string) => void;
  logout: () => void;
  /** 真实会话登录（api 模式）；profile 来自 /auth/me / login / register 响应 */
  signIn: (profile: UserProfile, returnTo?: string) => void;
  /** 真实会话登出（api 模式）：调用 /auth/logout 吊销后清空本地状态 */
  signOut: () => Promise<void>;
  setRole: (role: Role) => void;
  toggleFlag: (flag: Flag) => void;
  setFlag: (flag: Flag, value: boolean) => void;
  setDemoState: (state: DemoState) => void;
  pushToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
  setAuthReturnTo: (path: string | null) => void;
}

let state: AppState;
const listeners = new Set<() => void>();
let toastSeq = 1;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ---------------- 基础设施 ---------------- */

function setState(partial: Partial<AppState>) {
  state = { ...state, ...partial };
  persist();
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ role: state.role, flags: state.flags, demoState: state.demoState }),
    );
  } catch {
    /* ignore */
  }
}

function loadPersisted(): Partial<AppState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { role?: Role; flags?: Record<Flag, boolean>; demoState?: DemoState };
    const out: Partial<AppState> = {};
    if (parsed.role && VALID_ROLES.includes(parsed.role) && parsed.role !== "guest") {
      out.role = parsed.role;
      out.profile = profileFor(parsed.role);
      out.isAuthenticated = true;
    }
    if (parsed.flags) {
      const flags: Record<Flag, boolean> = { ...FLAG_DEFAULTS };
      for (const f of ALL_FLAGS) if (typeof parsed.flags[f] === "boolean") flags[f] = parsed.flags[f]!;
      out.flags = flags;
    }
    if (parsed.demoState && VALID_STATES.includes(parsed.demoState)) out.demoState = parsed.demoState;
    return out;
  } catch {
    return {};
  }
}

function applyUrlQuery(): Partial<AppState> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const out: Partial<AppState> = {};
  const role = q.get("role");
  if (role && VALID_ROLES.includes(role as Role)) {
    const r = role as Role;
    out.role = r;
    out.profile = profileFor(r);
    out.isAuthenticated = r !== "guest";
  }
  const st = q.get("state");
  if (st && VALID_STATES.includes(st as DemoState)) out.demoState = st as DemoState;
  const flag = q.get("flag");
  if (flag) {
    const flags: Record<Flag, boolean> = { ...FLAG_DEFAULTS };
    for (const f of ALL_FLAGS) flags[f] = flag !== f;
    out.flags = flags;
  }
  return out;
}

/* ---------------- 初始状态与动作 ---------------- */

function createInitialState(): AppState {
  const guestProfile = profileFor("guest");
  return {
    role: "guest",
    profile: guestProfile,
    isAuthenticated: false,
    realUser: null,
    flags: { ...FLAG_DEFAULTS },
    demoState: "normal",
    authReturnTo: null,
    toasts: [],
    consoleOpen: false,
    hydrated: false,
    setConsoleOpen: (open) => setState({ consoleOpen: open }),
    login: (role, returnTo) =>
      setState({
        role,
        profile: profileFor(role),
        isAuthenticated: role !== "guest",
        realUser: null,
        authReturnTo: returnTo ?? state.authReturnTo,
      }),
    logout: () => {
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setState({ role: "guest", profile: profileFor("guest"), isAuthenticated: false, realUser: null, authReturnTo: null });
    },
    signIn: (profile, returnTo) => {
      // 角色从后端画像派生；api 模式不依赖演示角色
      setState({
        role: profile.role,
        profile,
        realUser: profile,
        isAuthenticated: true,
        authReturnTo: returnTo ?? state.authReturnTo,
      });
    },
    signOut: async () => {
      try {
        await apiLogout();
      } catch {
        /* 幂等：服务端无会话也返回成功；网络失败仍清空本地 */
      }
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setState({ role: "guest", profile: profileFor("guest"), isAuthenticated: false, realUser: null, authReturnTo: null });
    },
    setRole: (role) => setState({ role, profile: profileFor(role), isAuthenticated: role !== "guest" }),
    toggleFlag: (flag) => setState({ flags: { ...state.flags, [flag]: !state.flags[flag] } }),
    setFlag: (flag, value) => setState({ flags: { ...state.flags, [flag]: value } }),
    setDemoState: (demoState) => setState({ demoState }),
    pushToast: (message, type = "success") => {
      const id = toastSeq++;
      setState({ toasts: [...state.toasts, { id, type, message }] });
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          setState({ toasts: state.toasts.filter((t) => t.id !== id) });
        }, 3200);
      }
    },
    dismissToast: (id) => setState({ toasts: state.toasts.filter((t) => t.id !== id) }),
    setAuthReturnTo: (path) => setState({ authReturnTo: path }),
  };
}

state = createInitialState();

export function useAppStore<T>(selector: (s: AppState) => T): T {
  // React 19 需要第三个参数 getServerSnapshot；state 为同步初始化的模块单例，
  // 服务端与客户端首帧快照一致，可安全用于 SSR/水合。
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

/* ---------------- Provider ---------------- */

export function AppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (isApiMode) {
      // api 模式：用真实会话恢复（刷新恢复）。me() 401 → 未登录。
      let cancelled = false;
      apiMe()
        .then((p) => {
          if (cancelled) return;
          if (p) {
            setState({
              role: p.role,
              profile: p,
              realUser: p,
              isAuthenticated: true,
              hydrated: true,
            });
          } else {
            setState({ role: "guest", profile: profileFor("guest"), isAuthenticated: false, realUser: null, hydrated: true });
          }
        })
        .catch(() => {
          if (cancelled) return;
          // 网络异常：不把用户误判为已登录，先按访客渲染并允许页面重试
          setState({ role: "guest", profile: profileFor("guest"), isAuthenticated: false, realUser: null, hydrated: true });
        });
      return () => {
        cancelled = true;
      };
    }
    // demo 模式：URL query 优先，其次本地持久化；应用后标记水合完成
    setState({ ...loadPersisted(), ...applyUrlQuery(), hydrated: true });
  }, []);
  return <>{children}</>;
}
