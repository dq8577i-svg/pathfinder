"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type ThemeMode = "light" | "dark";

const ThemeContext = createContext<{
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    let initial: ThemeMode = "dark";
    try {
      const stored = window.localStorage.getItem("pf-theme");
      if (stored === "light" || stored === "dark") initial = stored;
      else if (window.matchMedia("(prefers-color-scheme: light)").matches) initial = "light";
    } catch {
      /* 使用暗色默认值 */
    }
    queueMicrotask(() => setThemeState(initial));
    document.documentElement.dataset.theme = initial;
    document.documentElement.style.colorScheme = initial;
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try {
      window.localStorage.setItem("pf-theme", next);
    } catch {
      /* 存储不可用时仍保留当前会话主题 */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [setTheme, theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return value;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      className={cn("theme-switch", compact && "theme-switch-compact")}
      role="group"
      aria-label="外观主题"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn("theme-switch-button", theme === "light" && "is-active")}
        aria-pressed={theme === "light"}
        aria-label="使用浅色主题"
        title="浅色"
      >
        <Sun size={16} weight={theme === "light" ? "fill" : "regular"} />
        {!compact ? <span>浅色</span> : null}
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn("theme-switch-button", theme === "dark" && "is-active")}
        aria-pressed={theme === "dark"}
        aria-label="使用深色主题"
        title="深色"
      >
        <Moon size={16} weight={theme === "dark" ? "fill" : "regular"} />
        {!compact ? <span>深色</span> : null}
      </button>
    </div>
  );
}
