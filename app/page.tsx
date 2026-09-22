"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MagnifyingGlass, Path, Sparkle } from "@phosphor-icons/react";
import { useAppStore } from "@/lib/store";
import { Button, ButtonLink, SectionHeading, Card, Badge } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { DemoTag, AiNote } from "@/components/states";
import { resA1 } from "@/lib/demo";
import { formatDate, gradeLabel } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { ThemeToggle } from "@/components/theme";

const loopItems = [
  { step: "01 路径", text: "输入任意主题与目标，AI 拆解知识并编排学习顺序" },
  { step: "02 证据", text: "每一步配 A/B/C 分级公开资料与推荐理由" },
  { step: "03 练习", text: "把知识讲给 AI 听，暴露理解缺口" },
  { step: "04 反馈", text: "逐轮评价：已讲清 / 待补充 / 尚未覆盖" },
  { step: "05 下一步", text: "缺口回到节点，学习资产可恢复" },
];

const nots = [
  { title: "不是内容流", desc: "不按热度推流，只围绕你主动输入的主题和目标组织路径。" },
  { title: "不是题库", desc: "练习用来暴露理解缺口，不刷分、不排名。" },
  { title: "不是课程平台", desc: "不托管课程视频。我们编排路径与资料证据，指向可信公开来源。" },
];

const feynmanPoints = [
  "把你刚学的概念用大白话讲一遍",
  "AI 按当前节点能力目标追问，暴露模糊点",
  "生成结构化评价：已讲清 / 待补充 / 尚未覆盖",
];

const assetPoints = [
  "多条路径、笔记和练习草稿按账号恢复",
  "中断后可回到上次位置继续",
  "公开资料仅保存元数据与链接，可随时返回原始出处",
];

export default function LandingPage() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");

  useEffect(() => {
    if (isAuthenticated) router.replace("/home");
  }, [isAuthenticated, router]);

  function startWithTopic() {
    const next = topicDraft.trim();
    if (next) {
      try {
        window.localStorage.setItem("pf-pending-topic", next);
      } catch {
        /* 注册后仍可手动输入 */
      }
    }
    router.push("/register");
  }

  return (
    <div className="pf-app-canvas min-h-screen bg-canvas text-ink">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 border-b border-line bg-[var(--pf-header)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-2 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-ink">
            <span className="flex size-8 items-center justify-center rounded-md border border-line bg-subtle text-action"><Path size={18} weight="bold" /></span>
            知径 Pathfinder
          </Link>
          <span className="ml-1 hidden text-xs text-ink-3 sm:inline">AI 学习路径工作台</span>
          <div className="flex-1" />
          <a
            href="#mechanism"
            className="hidden h-11 items-center px-2 text-sm text-ink-2 hover:text-ink md:flex"
          >
            学习方式
          </a>
          <a
            href="#evidence"
            className="hidden h-11 items-center px-2 text-sm text-ink-2 hover:text-ink md:flex"
          >
            证据机制
          </a>
          <Link
            href="/login"
            className="flex h-11 items-center px-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            登录
          </Link>
          <ThemeToggle compact />
          <ButtonLink href="/register">开始学习</ButtonLink>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto grid min-h-[680px] max-w-[1280px] items-center gap-12 px-4 py-16 md:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)] lg:py-24">
          <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-subtle px-3 py-1 text-xs font-medium text-ink-2">
            <Sparkle size={13} className="text-[var(--pf-ai)]" /> AI 学习路径工作台
            <DemoTag />
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.05em] text-ink md:text-6xl">
            你想学什么，AI 就为你生成一条能执行的学习路径
          </h1>
          <p className="mt-5 max-w-2xl text-base text-ink-2 md:text-lg">
            输入主题、当前基础和可投入时间；AI 拆解知识节点，匹配可核验资料，再用费曼练习验证理解。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/register" className="pf-primary-motion">创建我的学习路径 <ArrowRight size={16} /></ButtonLink>
            <ButtonLink href="#mechanism" variant="secondary">
              查看学习方式
            </ButtonLink>
          </div>
          <p className="mt-6 text-xs text-ink-3">
            支持任意明确主题，并可同时管理多条学习路径。产品经理等主题提供已策展教材模板。
          </p>
          </div>

          <div className="pf-glass rounded-xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-xs font-medium tracking-[0.14em] text-ink-3">START A PATH</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">从一个真实想法开始</h2>
              </div>
              <span className="flex size-10 items-center justify-center rounded-md bg-[var(--pf-ai-soft)] text-[var(--pf-ai)]"><Sparkle size={19} weight="fill" /></span>
            </div>
            <label htmlFor="landing-topic" className="mt-5 block text-sm font-medium text-ink">我想学习</label>
            <div className="pf-command-surface mt-2 flex min-h-14 items-center gap-3 rounded-lg px-4">
              <MagnifyingGlass size={18} className="text-action" />
              <input
                id="landing-topic"
                value={topicDraft}
                onChange={(event) => setTopicDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && startWithTopic()}
                placeholder="例如：Python 数据分析、摄影、日语口语"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
              />
              <kbd className="rounded border border-line bg-subtle px-2 py-1 font-mono text-[10px] text-ink-3">ENTER</kbd>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Python 数据分析", "摄影", "日语口语"].map((item) => (
                <button key={item} type="button" onClick={() => setTopicDraft(item)} className="pf-interactive min-h-9 rounded-md border border-line bg-surface/55 px-3 text-xs text-ink-2 hover:bg-subtle hover:text-ink">{item}</button>
              ))}
            </div>
            <button type="button" onClick={startWithTopic} className="pf-button-primary pf-primary-motion mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium">
              生成我的路径 <ArrowRight size={16} />
            </button>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
              <div><p className="text-lg font-semibold text-ink">多路径</p><p className="text-[11px] text-ink-3">独立保存</p></div>
              <div><p className="text-lg font-semibold text-ink">A/B/C</p><p className="text-[11px] text-ink-3">来源分级</p></div>
              <div><p className="text-lg font-semibold text-ink">费曼</p><p className="text-[11px] text-ink-3">验证理解</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* 学习闭环 */}
      <section id="mechanism" className="scroll-mt-16 border-b border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-14 md:px-8">
          <SectionHeading
            title="学习闭环"
            description="路径 → 证据 → 练习 → 反馈 → 下一步，每一步都有依据、可恢复。"
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {loopItems.map((item) => (
              <Card key={item.step} className="p-4">
                <p className="text-sm font-semibold text-ink">{item.step}</p>
                <p className="mt-1.5 text-sm text-ink-2">{item.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 三个不是 */}
      <section className="border-b border-line bg-subtle/50">
        <div className="mx-auto max-w-[1200px] px-4 py-14 md:px-8">
          <SectionHeading
            title="这不是什么"
            description="我们刻意不做这三类产品，把精力放在「可解释的学习路径」上。"
          />
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {nots.map((item) => (
              <Card key={item.title} className="p-5">
                <p className="text-base font-semibold text-ink">{item.title}</p>
                <p className="mt-2 text-sm text-ink-2">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 可解释证据 */}
      <section id="evidence" className="scroll-mt-16 border-b border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-14 md:px-8">
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <div>
              <SectionHeading
                title="可解释的证据"
                description="每条路径的核心节点都可关联 A/B/C 分级资料，标注来源等级、检索/校验时间与推荐理由。"
              />
              <ul className="mt-5 space-y-2 text-sm text-ink-2">
                <li className="flex gap-2">
                  <span className="shrink-0 text-success">A</span> 级：自有教材、官方文档与高校公开课
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 text-warning">B</span> 级：专业机构方法文章
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 text-ink-3">C</span> 级：延伸参考，不作为完成核心依据
                </li>
              </ul>
              <p className="mt-5 text-xs text-ink-3">
                DeepSeek 负责编排与反馈；实时资料由独立搜索服务检索，模型不等同搜索引擎。
              </p>
            </div>
            <Card className="p-5">
              <p className="mb-3 text-xs font-medium text-ink-3">产品经理主题的资料卡示例</p>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{resA1.title}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {resA1.domain} · {resA1.sourceName} · {resA1.sourceType}
                  </p>
                </div>
                <Badge tone="success">{gradeLabel(resA1.grade)}</Badge>
              </div>
              <p className="mt-3 text-sm text-ink-2">{resA1.reason}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-ink-3">
                  检索于 {formatDate(resA1.retrievedAt)} · 校验于 {formatDate(resA1.checkedAt)}
                </span>
                <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
                  查看来源
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 费曼追问 + 可恢复资产 */}
      <section className="border-b border-line bg-subtle/50">
        <div className="mx-auto grid max-w-[1200px] gap-3 px-4 py-14 md:grid-cols-2 md:px-8">
          <Card className="p-6">
            <p className="text-base font-semibold text-ink">AI 费曼追问</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-2">
              {feynmanPoints.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="shrink-0 text-ink-3">·</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <p className="text-base font-semibold text-ink">可恢复学习资产</p>
            <ul className="mt-4 space-y-2 text-sm text-ink-2">
              {assetPoints.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="shrink-0 text-ink-3">·</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* CTA 收尾 */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-16 text-center md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">从你真正想学的主题开始</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-2">
            3 分钟完成目标诊断，AI 编排学习顺序，每一步给出可核验资料。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/register">开始学习</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              我有账号，登录
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="bg-canvas">
        <div className="mx-auto max-w-[1200px] px-4 py-10 md:px-8">
          <p className="text-sm text-ink-3">
            <AiNote /> · {isApiMode
              ? "当前为前后端联调模式，演示账号、路径、练习与资料库经真实 API 保存。"
              : "当前为本地演示模式，所有 AI 内容和业务数据均明确标注为演示。"}
          </p>
          <p className="mt-2 text-xs text-ink-3">
            DeepSeek 负责编排与反馈；实时资料由独立搜索服务检索。外链将适用原机构隐私与版权条款，仅保存必要元数据与摘要。
          </p>
          <p className="mt-4 text-xs text-ink-3">© 2026 知径 Pathfinder · 隐私与版权说明</p>
        </div>
      </footer>

      {/* 站外跳转确认 */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="将前往站外内容"
        description="该资料由站外机构提供，将适用其隐私与版权条款。知径仅保存元数据与摘要，不复制正文。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                window.open(resA1.url, "_blank", "noopener,noreferrer");
                setConfirmOpen(false);
              }}
            >
              确认前往
            </Button>
          </>
        }
      />
    </div>
  );
}
