"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Button, Card, Field, Select, Textarea } from "@/components/ui";
import { DemoTag, ErrorState } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { PEER_REVIEW } from "@/lib/demo";
import { mockFetch } from "@/lib/utils";

export default function ReviewPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const review = reviewId === PEER_REVIEW.id ? PEER_REVIEW : null;
  const demoState = useAppStore((s) => s.demoState);

  return (
    <FeatureGate
      flag="peer_feedback"
      title="同伴反馈暂未开放"
      description="对获授权的小队作品给出「亮点 + 改进 + 量规」的结构化反馈。"
    >
      {review ? <ReviewDetail key={review.id} /> : <ErrorState title="未找到该反馈" description="该作品不存在或分享已被撤回。" backTo="/crews" />}
      <StateBanner state={demoState} />
    </FeatureGate>
  );
}

function ReviewDetail() {
  const [feedbackStatus, setFeedbackStatus] = useState<"pending" | "submitted">(PEER_REVIEW.myFeedbackStatus);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ highlight: "", improvement: "", criterion: "清晰度" });
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(
    () => new Set(PEER_REVIEW.feedbacks.filter((f) => f.helpful).map((f) => f.author)),
  );
  const pushToast = useAppStore((s) => s.pushToast);
  const demoState = useAppStore((s) => s.demoState);

  async function handleSubmitFeedback() {
    if (saving) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    if (!form.highlight.trim() || !form.improvement.trim()) {
      pushToast("请填写「亮点」与「可执行改进」", "warning");
      return;
    }
    setSaving(true);
    try {
      await mockFetch(null, { latency: [350, 550] });
      setFeedbackStatus("submitted");
      pushToast("反馈已提交（演示）");
    } catch {
      pushToast("提交失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  function markHelpful(author: string) {
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    pushToast(`已标记「${author}」的反馈有帮助（演示）`);
    setHelpfulIds((prev) => new Set(prev).add(author));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={PEER_REVIEW.submissionTitle}
        description={`作者：${PEER_REVIEW.submissionAuthor} · ${PEER_REVIEW.visibility}`}
        meta={
          <>
            <Badge tone="info">同伴反馈</Badge>
            <DemoTag />
          </>
        }
      />

      {/* 政策横幅 */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2.5 text-sm text-warning">
        <span aria-hidden="true">!</span>
        <span>小队约定：只点评作品，不评价人格；默认不展示练习对话。</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* 作品原文 */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-base font-semibold text-ink">作品原文</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{PEER_REVIEW.submissionBody}</p>
            <div className="mt-3">
              <p className="text-sm font-medium text-ink">评审维度</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PEER_REVIEW.rubric.map((r) => (
                  <Badge key={r} tone="neutral">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          {/* 已有反馈 */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-base font-semibold text-ink">已有反馈</h2>
            <ul className="mt-2 divide-y divide-line">
              {PEER_REVIEW.feedbacks.map((f) => (
                <li key={f.author} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-ink">{f.author}</span>
                      <Badge tone="info">{f.criterion}</Badge>
                      {helpfulIds.has(f.author) ? <Badge tone="success">有帮助</Badge> : null}
                    </div>
                    {!helpfulIds.has(f.author) ? (
                      <Button variant="ghost" size="sm" onClick={() => markHelpful(f.author)}>
                        标记有帮助
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-1.5 space-y-1 text-sm text-ink">
                    <p>
                      <span className="font-medium text-success">亮点：</span>
                      {f.highlight}
                    </p>
                    <p>
                      <span className="font-medium text-warning">改进：</span>
                      {f.improvement}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* 我的反馈 */}
        <div>
          <Card className="p-4 sm:p-5">
            {feedbackStatus === "pending" ? (
              <>
                <h2 className="text-base font-semibold text-ink">我的反馈</h2>
                <p className="mt-1 text-sm text-ink-2">采用「一个亮点 + 一条可执行改进 + 对应量规」结构。</p>
                <div className="mt-3 space-y-3">
                  <Field label="亮点（优点）" htmlFor="fb-highlight">
                    <Textarea
                      id="fb-highlight"
                      value={form.highlight}
                      onChange={(e) => setForm((f) => ({ ...f, highlight: e.target.value }))}
                      placeholder="具体指出做得好的地方，例如「点出了真实场景」"
                    />
                  </Field>
                  <Field label="可执行改进" htmlFor="fb-improvement">
                    <Textarea
                      id="fb-improvement"
                      value={form.improvement}
                      onChange={(e) => setForm((f) => ({ ...f, improvement: e.target.value }))}
                      placeholder="给出下一步可操作的改进，例如「补充基线数据」"
                    />
                  </Field>
                  <Field label="对应量规" htmlFor="fb-criterion">
                    <Select
                      id="fb-criterion"
                      value={form.criterion}
                      onChange={(e) => setForm((f) => ({ ...f, criterion: e.target.value }))}
                    >
                      {PEER_REVIEW.rubric.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button className="w-full" onClick={handleSubmitFeedback} loading={saving}>
                    提交反馈
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-ink">我的反馈</h2>
                <div className="mt-2 rounded-md border border-success/30 bg-success-bg px-3 py-2.5 text-sm text-success">
                  已提交反馈（演示）。可在他人反馈上标记「有帮助」，被反馈者不可修改原反馈。
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
