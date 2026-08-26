# 知径 Pathfinder · AI 学习路径工作台（Web 演示）

基于系统 PRD v1.4 的全量交互原型（P0–P2）。产品机制：**可信教材能力骨架 + AI 编排（演示模拟）+ 可解释公开资料证据 + AI 费曼追问 + 可恢复学习资产** —— 不是内容流、不是题库、不是课程平台、不是聊天机器人。核心学习闭环：**路径 → 证据 → 练习 → 反馈 → 下一步**。

- 纯前端实现：Mock 数据 + 服务端可选 AI 引擎，不依赖真实数据库 / 对象存储 / 搜索 API。
- 所有 AI 生成内容标注「AI 整理（演示）」；所有业务数据标注「演示数据」。
- 前端零密钥：Token 只存在于本机 `.env.local`（已被 gitignore 排除），绝不进入代码、页面、README 或日志。

## 技术栈

- Next.js 16.2.10（App Router）+ React 19 + TypeScript strict
- Tailwind CSS v4（CSS-first `@theme` 设计系统，中性极简「编辑式学习工作台」风格）
- 零状态库依赖：`useSyncExternalStore` 手写 AppStore

## 快速启动

```bash
cd pathfinder/site
npm install        # 首次
npm run dev        # 开发：http://localhost:3000
```

构建与预览：

```bash
npm run build && npm start
```

> 无需任何密钥即可运行：默认使用 Mock AI 引擎（`lib/ai/mock.ts`），无外发请求。

## AI 引擎接入（可选）

演示默认走 Mock。如需接入真实 DeepSeek（Anthropic 兼容端点），复制 `.env.example` 为 `.env.local` 并设置：

```
DEEPSEEK_ENABLED=true
DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic
DEEPSEEK_API_KEY=<你的令牌>
DEEPSEEK_MODEL=deepseek-chat
```

规则：

- 令牌只在**服务端 Route Handler**（`app/api/ai/chat/route.ts`）读取，客户端 bundle、页面、README、日志中均不含密钥。
- `.env.local` 已加入 `.gitignore`；仓库只提交 `.env.example`（占位）。
- 若令牌曾在聊天、截图、日志或仓库中暴露，请立即在 DeepSeek 控制台**撤销并重签**。
- 切换引擎不改变页面交互；AI 来源可在「演示控制台 → AI 引擎」查看。

## 路由清单

### P0 主闭环
| 路由 | 说明 |
| --- | --- |
| `/` | 产品落地页（访客） |
| `/login` | 登录 / 以演示角色快速进入 |
| `/register` | 注册 |
| `/onboarding` | 4 步目标诊断 → AI 编排（模拟）→ 路径确认 |
| `/home` | 学习首页（按角色作用域） |
| `/path` | 知识树页（5 种节点状态） |
| `/path/nodes/[nodeId]` | 知识节点详情 + A/B/C 证据抽屉 + 完成/撤销 |
| `/practice/[sessionId]` | 费曼练习对话（专注模式） |
| `/practice/[sessionId]/result` | 评价与笔记页 |
| `/notes` | 我的费曼笔记 |

### P1 强化学习
`/review`（复习中心）、`/labs`（情境练习场列表）、`/labs/[scenarioId]`（情境详情）、`/skills`（技能雷达）、`/library`（个人资料库）、`/admin/content`（内容运营台，仅内容管理员）。

### P2 空间与协作
`/space`（学习空间）、`/paths`（多路径列表）、`/paths/[pathId]`（路径详情与计划调整）、`/crews`（小队）、`/crews/[crewId]`（小队详情与挑战）、`/reviews/[reviewId]`（同伴反馈）、`/portfolio`（作品集）、`/search`（语义检索）、`/org/[tenantSlug]`（机构学习主页）、`/org/[tenantSlug]/admin`（机构管理，仅机构管理员）。

> 功能开关关闭时：导航隐藏对应入口；直接访问路由显示「功能暂未开放」+ 返回 CTA，**绝不返回 404**。角色不符：显示 403 说明原因，不泄露数据。

## 演示角色

| 角色 | query | 说明 |
| --- | --- | --- |
| 访客 | `?role=guest` | 仅落地页 / 登录 / 注册 |
| 新学习者·林然 | `?role=new_learner` | 无路径，6 周 / 每周 5 小时；注册、诊断、路径确认 |
| 在学学习者·陈思 | `?role=learner` | 4/19 已完成，当前节点「从表象需求到真实需求」 |
| 练习中学习者·周宁 | `?role=practice_learner` | 3 轮未完成费曼会话 + 本地草稿（离线/同步链路） |
| 内容管理员·陈岚 | `?role=content_admin` | 资源审核队列；不可查看私人笔记正文/完整费曼对话 |
| 机构管理员·张磊 | `?role=org_admin` | 仅本机构脱敏聚合数据 |

角色可通过 URL `?role=`、`/login`、或隐藏原型控制台切换（会持久化到 localStorage）。

## 功能开关（Feature Flags）

13 个开关：`review_center`、`scenario_labs`、`multi_path`、`crews`、`semantic_search`、`tenant_workspace`、`skill_radar`、`personal_library`、`content_console`、`learning_space`、`adaptive_plan`、`portfolio`、`peer_feedback`。默认全部开启。

- 关闭单个：`?flag=crews`（关闭 crews，其余保留默认）
- 控制台：演示控制台 → 功能开关逐项切换

## 演示状态（Demo States）

URL `?state=` 或演示控制台切换：

`offline`（离线，写入不伪造已保存）、`ai_error`（AI 暂不可用，前端短路模拟失败）、`evidence_insufficient`（证据不足）、`empty`（空状态）、`forbidden`（无权限）、`normal`（默认）。

## Mock 数据位置

| 文件 | 内容 |
| --- | --- |
| `lib/types.ts` | 全量领域类型契约（兼容未来 PostgreSQL/Redis/MinIO/DeepSeek/pgvector 架构） |
| `lib/demo/data.ts` | 教材资源证据（A/B/C 分级）、19 节点课程、路径、练习会话、费曼笔记 |
| `lib/demo/users.ts` | 5 个演示角色与资料 |
| `lib/demo/p1-data.ts` | 记忆卡片、情境练习场、技能雷达、资料库、内容运营台 |
| `lib/demo/p2-data.ts` | 学习空间、小队/挑战/反馈、作品集、语义检索、机构空间 |
| `lib/demo/index.ts` | 数据聚合出口与角色作用域选择器 |

## 架构要点

- `lib/ai/*`：AI Provider 抽象（Mock / DeepSeek），服务端 Route Handler 鉴权，客户端 `useAiChat()` 只与 `/api/ai/chat` 通信。
- `lib/store.tsx`：AppStore（角色/鉴权/开关/演示态/Toast/持久化）。
- `components/guards.tsx`：RequireAuth（401→登录+returnTo）、FeatureGate、RoleGate。
- `components/ui.tsx` 等：设计系统原语（44px 点击目标、键盘焦点、状态必带文字）。
- 响应式：桌面 Topbar 56px + Sidebar 240px + 内容最大 1200px；390px 移动端侧栏转抽屉、单列布局。

## 已知限制

- 纯前端演示：练习会话、草稿、设置仅存于浏览器 localStorage，刷新不丢失，但不做真实多端同步。
- 「AI 编排」「语义检索」为演示模拟；真实接入需在服务端注入 DeepSeek 与 Search Provider。
- 机构聚合数据为脱敏演示数据，不反映真实学习者。

## E2E 验收结果

8/8 条验收链路全部通过（断言全绿），基于 `next start` 生产构建 + Mock AI 引擎（确定性回复、零外发请求）。

| # | 链路 | 断言 |
| --- | --- | --- |
| 1 | 注册 → 诊断 → 路径证据 → 确认 → 首页 | 19/19 |
| 2 | 首页 → 节点 → 费曼 → 评价 → 下一步 | 31/31 |
| 3 | 周宁 离线 → 恢复 → 同步 | 10/10 |
| 4 | 复习 → 情境练习 → 技能 | 17/17 |
| 5 | 多路径 → 计划调整 → 作品集分享 | 12/12 |
| 6 | 功能开关 `flag=crews` 关闭 | 5/5 |
| 7 | 租户 / 角色隔离 | 13/13 |
| 8 | 视口与健康检查（26 路由） | 5/5 |

全局扫描：**无死链、无 4xx/5xx、无控制台错误、无页面 JS 错误、无 `sk-` 令牌**。26 个路由在 1440px / 390px 双视口下均无横向溢出、无空白页、无被遮挡的点击目标。

验收中修复的问题（均已重建生效）：

- `components/shell.tsx`：「机构空间」导航指向无路由的 `/org`，改为 `/org/${TENANT.slug}`，消除死链。
- `app/practice/[sessionId]/result/page.tsx`：修复生产水合错误 React #418（demo 数据 `daysAgo(0)` 在 SSR 与客户端渲染分钟级漂移导致文本不匹配）——改用 mounted 门控，首帧渲染「——」，挂载后再渲染真实时间。
- `app/icon.svg`：新增站点图标，浏览器经 `<link rel="icon">` 使用 `/icon.svg`，不再回退请求 `/favicon.ico`。
- 数据建模说明（非缺陷）：进行中会话 `session-active-chen` 的结果页正确显示「练习尚未完成」；完整评价页由已完成会话 `session-done-01` 演示。

E2E runner 保留于 `e2e-tmp/run.js` + `e2e-tmp/lib.js`，可复跑 8 条链路。已知浏览器级现象：`<Link>` 的 `?_rsc=` 预取请求被后续导航打断时产生 `net::ERR_ABORTED`，属预取取消，非 HTTP 失败，不计入 4xx/5xx。
