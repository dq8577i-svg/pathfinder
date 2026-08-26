"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button, ButtonLink, SectionHeading, Card, Badge } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { DemoTag, AiNote } from "@/components/states";
import { resA1 } from "@/lib/demo";
import { formatDate, gradeLabel } from "@/lib/utils";

const loopItems = [
  { step: "① 路径", text: "目标诊断 + 教材能力骨架，AI 编排学习顺序" },
  { step: "② 证据", text: "每一步配 A/B/C 分级公开资料与推荐理由" },
  { step: "③ 练习", text: "把知识讲给 AI 听，暴露理解缺口" },
  { step: "④ 反馈", text: "逐轮评价：已讲清 / 待补充 / 尚未覆盖" },
  { step: "⑤ 下一步", text: "缺口回到节点，学习资产可恢复" },
];

const nots = [
  { title: "不是内容流", desc: "不按热度推流。只按你的目标与教材能力骨架编排路径。" },
  { title: "不是题库", desc: "练习用来暴露理解缺口，不刷分、不排名。" },
  { title: "不是课程平台", desc: "不托管课程视频。我们编排路径与资料证据，指向可信公开来源。" },
];

const feynmanPoints = [
  "把你刚学的概念用大白话讲一遍",
  "AI 按教材骨架追问，暴露模糊点",
  "生成结构化评价：已讲清 / 待补充 / 尚未覆盖",
];

const assetPoints = [
  "路径、笔记、练习草稿按角色恢复",
  "中断后可回到上次位置继续",
  "公开资料仅保存元数据与链接，可随时返回原始出处",
];

export default function LandingPage() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/home");
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4 md:px-8">
          <Link href="/" className="text-base font-semibold tracking-tight text-ink">
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
            教材范围
          </a>
          <Link
            href="/login"
            className="flex h-11 items-center px-2 text-sm font-medium text-ink-2 hover:text-ink"
          >
            登录
          </Link>
          <ButtonLink href="/register">开始学习</ButtonLink>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-8 md:py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-subtle px-3 py-1 text-xs font-medium text-ink-2">
            AI 学习路径工作台
            <DemoTag />
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
            把产品经理教材，学成能讲清、能落地的能力
          </h1>
          <p className="mt-5 max-w-2xl text-base text-ink-2 md:text-lg">
            AI 按你的目标编排路径；每一步给出可核验资料；用费曼练习验证理解。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/register">创建我的学习路径</ButtonLink>
            <ButtonLink href="#mechanism" variant="secondary">
              查看学习方式
            </ButtonLink>
          </div>
          <p className="mt-6 text-xs text-ink-3">
            首发仅覆盖「AI 产品经理基础能力路径」；不保证求职或录用结果。
          </p>
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
                description="每个核心节点都关联 A/B/C 分级公开资料，标注来源等级、检索/校验时间与推荐理由。"
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
          <h2 className="text-2xl font-semibold tracking-tight text-ink">从一条有依据的路径开始</h2>
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
            <AiNote /> · 本页面为纯前端演示，所有 AI 内容标注「AI 整理（演示）」，所有数据均为演示数据。
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
