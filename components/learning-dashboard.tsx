"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  CaretDown,
  CaretRight,
  Check,
  Clock,
  Command,
  FileText,
  MagnifyingGlass,
  Path,
  Play,
  Plus,
  Sparkle,
} from "@phosphor-icons/react";
import { Badge, ButtonLink, ProgressBar } from "@/components/ui";
import { cn, formatMinutes } from "@/lib/utils";
import type { LearningPath, KnowledgeNode } from "@/lib/types";

interface LearningDashboardProps {
  path: LearningPath;
  paths?: LearningPath[];
  current: KnowledgeNode;
  learnerName: string;
  onSwitchPath?: (pathId: string) => void;
  practiceHref?: string;
  recentItems?: { title: string; meta: string; href: string }[];
}

function statusText(node: KnowledgeNode) {
  if (node.status === "completed") return "已完成";
  if (node.status === "current" || node.status === "in_progress") return "当前学习";
  if (node.status === "available") return "可开始";
  return "完成前置节点后解锁";
}

export function LearningDashboard({
  path,
  paths = [path],
  current,
  learnerName,
  onSwitchPath,
  practiceHref,
  recentItems = [],
}: LearningDashboardProps) {
  const [pathMenuOpen, setPathMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [assistantTab, setAssistantTab] = useState<"node" | "resources">("node");
  const [whyOpen, setWhyOpen] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...path.nodes].sort((a, b) => a.sequence - b.sequence),
    [path.nodes],
  );
  const currentIndex = Math.max(0, ordered.findIndex((node) => node.id === current.id));
  const nextNodes = ordered.slice(currentIndex + 1, currentIndex + 7);
  const displayNodes = nextNodes.length > 0 ? nextNodes : ordered.slice(0, 6);
  const verified = current.resources.filter((resource) => resource.accessibilityStatus === "verified");
  const aCount = current.resources.filter((resource) => resource.grade === "A").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-ink-3">WELCOME BACK · {learnerName}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink md:text-4xl">继续学习</h1>
          <p className="mt-1.5 text-sm text-ink-2">你的个人学习操作系统：更专注、更有路径、更进一步。</p>
        </div>
        <button
          type="button"
          onClick={() => setAssistantOpen((open) => !open)}
          className="pf-interactive hidden min-h-11 items-center gap-2 rounded-md border border-line bg-surface/70 px-3 text-sm text-ink-2 hover:text-ink xl:flex"
          aria-expanded={assistantOpen}
        >
          <Sparkle size={17} className="text-[var(--pf-ai)]" />
          {assistantOpen ? "收起学习助手" : "展开学习助手"}
        </button>
      </div>

      <div className={cn("grid items-start gap-4", assistantOpen && "xl:grid-cols-[minmax(0,1fr)_340px]")}> 
        <div className="min-w-0 space-y-4">
          <div className="relative z-20 flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setPathMenuOpen((open) => !open)}
                className="pf-interactive pf-current-glow flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface/80 px-3 text-sm font-medium text-ink"
                aria-expanded={pathMenuOpen}
                aria-haspopup="menu"
              >
                <Path size={18} weight="fill" className="text-action" />
                <span className="max-w-[260px] truncate">{path.title.replace("学习路径", "")}</span>
                <CaretDown size={14} className={cn("transition-transform", pathMenuOpen && "rotate-180")} />
              </button>
              {pathMenuOpen ? (
                <div className="pf-command-surface absolute left-0 top-[calc(100%+6px)] w-[310px] overflow-hidden rounded-lg p-1.5 shadow-pop" role="menu">
                  {paths.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSwitchPath?.(item.id);
                        setPathMenuOpen(false);
                      }}
                      className={cn(
                        "pf-interactive flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left",
                        item.id === path.id ? "bg-[var(--pf-active-soft)] text-ink" : "text-ink-2 hover:bg-subtle",
                      )}
                    >
                      <span className="flex size-7 items-center justify-center rounded-md border border-line bg-surface text-action">
                        {item.id === path.id ? <Check size={15} weight="bold" /> : <Path size={15} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-ink-3">{item.progress.total} 个学习节点</span>
                      </span>
                    </button>
                  ))}
                  <Link
                    href="/onboarding"
                    className="pf-interactive mt-1 flex min-h-11 items-center gap-3 border-t border-line px-3 pt-1 text-sm font-medium text-action"
                  >
                    <Plus size={17} /> 新建路径
                  </Link>
                </div>
              ) : null}
            </div>
            <ButtonLink href="/onboarding" variant="secondary">
              <Plus size={17} /> 新建路径
            </ButtonLink>
          </div>

          <section className="pf-card overflow-hidden" aria-labelledby="current-node-title">
            <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_240px] md:p-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium tracking-[0.12em] text-ink-3">今日安排 · 当前学习</span>
                  <Badge tone="info">进行中</Badge>
                </div>
                <h2 id="current-node-title" className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-ink">
                  {current.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">{current.capabilityGoal}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
                  <span className="inline-flex items-center gap-1.5"><Clock size={15} />预计 {formatMinutes(current.estimatedMinutes)}</span>
                  <span className="inline-flex items-center gap-1.5"><BookOpenText size={15} />A 级来源 {aCount} 条</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <ButtonLink href={`/path/nodes/${current.id}`} className="pf-primary-motion min-w-[200px]">
                    <Play size={17} weight="fill" /> 继续学习 {formatMinutes(current.estimatedMinutes)}
                    <ArrowRight size={16} />
                  </ButtonLink>
                  {practiceHref ? (
                    <ButtonLink href={practiceHref} variant="secondary">
                      开始费曼练习
                    </ButtonLink>
                  ) : (
                    <ButtonLink href={`/path/nodes/${current.id}`} variant="secondary">查看节点详情</ButtonLink>
                  )}
                </div>
              </div>
              <div className="border-t border-line pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <span className="sr-only">{path.progress.completed}/{path.progress.total} 节点</span>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight text-ink">{path.progress.completed}</span>
                  <span className="pb-1 text-lg text-ink-3">/ {path.progress.total}</span>
                </div>
                <p className="mt-1 text-xs text-ink-3">当前进度</p>
                <ProgressBar value={path.progress.completed} max={path.progress.total} className="mt-3" />
                <div className="mt-6 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold text-ink">{path.weeklyHours}<span className="ml-1 text-sm font-medium">小时</span></p>
                    <p className="mt-1 text-xs text-ink-3">本周学习目标</p>
                  </div>
                  <span className="text-xs text-ink-3">保持节奏</span>
                </div>
              </div>
            </div>

            <div className="border-t border-line px-5 py-5 md:px-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-ink">后续 {displayNodes.length} 个学习节点</h3>
                  <p className="mt-1 text-xs text-ink-3">按依赖顺序推荐，完成当前节点后依次解锁</p>
                </div>
                <ButtonLink href="/path" variant="ghost" size="sm">查看完整路径 <ArrowRight size={14} /></ButtonLink>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {displayNodes.map((node) => (
                  <div
                    key={node.id}
                    className={cn(
                      "pf-interactive relative min-h-[112px] rounded-md border border-line bg-surface/55 p-3",
                      hoveredNode === node.id && "pf-current-glow bg-[var(--pf-active-soft)]",
                    )}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onFocus={() => setHoveredNode(node.id)}
                    onBlur={() => setHoveredNode(null)}
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink-2">{node.sequence}</span>
                      <CaretRight size={13} className="text-ink-3" />
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm font-medium text-ink">{node.title}</p>
                    {hoveredNode === node.id ? (
                      <div className="absolute left-1/2 top-[calc(100%+8px)] z-30 w-52 -translate-x-1/2 rounded-md border border-line bg-surface p-3 text-xs shadow-pop">
                        <p className="inline-flex items-center gap-1.5 text-ink-2"><Clock size={13} />预计 {formatMinutes(node.estimatedMinutes)}</p>
                        <p className="mt-1 text-ink-3">{statusText(node)}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="pf-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-ink">最近学习</h2>
                <Link href="/notes" className="text-xs text-ink-3 hover:text-action">查看全部</Link>
              </div>
              <div className="mt-3 divide-y divide-line">
                {(recentItems.length ? recentItems : [
                  { title: current.title, meta: "上次学习 · 今天", href: `/path/nodes/${current.id}` },
                  { title: path.nodes[0]?.title ?? path.title, meta: "已完成 · 3 天前", href: "/path" },
                ]).slice(0, 3).map((item) => (
                  <Link key={item.title} href={item.href} className="pf-interactive flex min-h-14 items-center gap-3 py-2.5">
                    <span className="flex size-9 items-center justify-center rounded-md bg-[var(--pf-active-soft)] text-action"><Play size={15} weight="fill" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                      <span className="text-xs text-ink-3">{item.meta}</span>
                    </span>
                    <Check size={16} weight="bold" className="text-success" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="pf-card p-5">
              <h2 className="text-base font-semibold text-ink">快捷操作</h2>
              <div className="mt-3 grid gap-1">
                <Link href="/search" className="pf-interactive flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink"><MagnifyingGlass size={17} />搜索或提问 <kbd className="ml-auto rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[10px]"><Command size={10} className="inline" /> K</kbd></Link>
                <Link href="/paths" className="pf-interactive flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink"><Path size={17} />切换学习路径</Link>
                <Link href="/library" className="pf-interactive flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink"><BookOpenText size={17} />打开资源库</Link>
                <Link href="/notes" className="pf-interactive flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-ink-2 hover:bg-subtle hover:text-ink"><FileText size={17} />新建学习笔记</Link>
              </div>
            </section>
          </div>
        </div>

        {assistantOpen ? (
          <aside className="pf-glass sticky top-[92px] hidden max-h-[calc(100vh-112px)] overflow-y-auto rounded-lg p-4 xl:block pf-scroll-thin" aria-label="学习助手">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkle size={19} weight="fill" className="text-[var(--pf-ai)]" />
                <h2 className="text-lg font-semibold text-ink">学习助手</h2>
              </div>
              <button type="button" onClick={() => setAssistantOpen(false)} className="min-h-11 rounded-md px-2 text-xs text-ink-3 hover:bg-subtle hover:text-ink">收起</button>
            </div>
            <div className="mt-3 flex border-b border-line" role="tablist" aria-label="学习助手内容">
              <button type="button" role="tab" aria-selected={assistantTab === "node"} onClick={() => setAssistantTab("node")} className={cn("min-h-11 flex-1 border-b-2 text-sm", assistantTab === "node" ? "border-action text-ink" : "border-transparent text-ink-3")}>当前节点</button>
              <button type="button" role="tab" aria-selected={assistantTab === "resources"} onClick={() => setAssistantTab("resources")} className={cn("min-h-11 flex-1 border-b-2 text-sm", assistantTab === "resources" ? "border-action text-ink" : "border-transparent text-ink-3")}>相关资源</button>
            </div>
            {assistantTab === "node" ? (
              <div className="mt-4 space-y-5">
                <section>
                  <button type="button" onClick={() => setWhyOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
                    <span className="text-base font-semibold text-ink">为什么现在学这个</span>
                    <Badge className="pf-ai-accent"><Sparkle size={12} />AI 解析</Badge>
                  </button>
                  <div className={cn("grid transition-[grid-template-rows] duration-300", whyOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}> 
                    <div className="overflow-hidden">
                      <p className="rounded-md border border-line bg-surface/55 p-3 text-sm leading-6 text-ink-2">
                        「{current.title}」承接你已经掌握的基础节点。完成它后，你会形成可复用的方法，为后续实战和成果输出建立可靠基础。
                      </p>
                    </div>
                  </div>
                </section>
                <section className="border-t border-line pt-4">
                  <h3 className="text-sm font-semibold text-ink">核心依赖</h3>
                  <ul className="mt-3 space-y-2">
                    {current.prerequisiteIds.length > 0 ? current.prerequisiteIds.slice(0, 3).map((id) => (
                      <li key={id} className="flex items-center gap-2 text-sm text-ink-2"><Check size={16} weight="bold" className="text-success" />{ordered.find((node) => node.id === id)?.title ?? "已完成前置知识"}</li>
                    )) : <li className="text-sm text-ink-3">当前节点没有强制前置知识。</li>}
                  </ul>
                </section>
                <section className="border-t border-line pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">权威学习资源</h3>
                    <span className="text-xs text-ink-3">{verified.length} 条已校验</span>
                  </div>
                  <Badge className="pf-ai-accent mt-3">A 级来源 · 高校公开课 · {Math.max(aCount, verified.length)} 条已校验</Badge>
                  <div className="mt-3 space-y-2">
                    {current.resources.slice(0, 2).map((resource) => (
                      <Link key={resource.id} href={`/path/nodes/${current.id}`} className="pf-interactive block rounded-md border border-line bg-surface/45 p-3 hover:bg-subtle">
                        <p className="line-clamp-2 text-sm font-medium text-ink">{resource.title}</p>
                        <p className="mt-1 text-xs text-ink-3">{resource.sourceName} · {resource.grade} 级</p>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {current.resources.length > 0 ? current.resources.map((resource) => (
                  <Link key={resource.id} href={`/path/nodes/${current.id}`} className="pf-interactive block rounded-md border border-line p-3 hover:bg-subtle">
                    <p className="text-sm font-medium text-ink">{resource.title}</p>
                    <p className="mt-1 text-xs text-ink-3">{resource.sourceName} · {resource.grade} 级资料</p>
                  </Link>
                )) : <p className="text-sm text-ink-3">当前节点暂未关联外部资源。</p>}
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
