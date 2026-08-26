# 知径 Pathfinder · AI 学习路径工作台

**让每一次学习都有路径、证据与反馈。**

知径（Pathfinder）是一个 AI 驱动的个性化学习工作台：输入一个想学的主题，系统编排出「基础入门 → 核心方法 → 综合实战」的进阶路径，每个环节挂载**可核验的公开资料证据**，再用 **AI 费曼追问**帮你把知识真正内化。

产品机制：**可信教材能力骨架 + AI 编排 + 可解释公开资料证据 + AI 费曼追问 + 可恢复学习资产** —— 不是内容流、不是题库、不是课程平台、不是聊天机器人。

核心学习闭环：**路径 → 证据 → 练习 → 反馈 → 下一步**。

- 🔗 **在线体验**（公网 demo）：https://site-seven-weld-91.vercel.app —— 免注册一键进入，输入任意主题（如「高中生物」「Python 数据分析」「摄影」），全部模块即刻跟随该主题生成内容
- 🧩 **开源代码**：https://github.com/dq8577i-svg/pathfinder

## 核心亮点

| 亮点 | 说明 |
|---|---|
| 主题驱动的路径编排 | 输入主题 → 生成三阶技能路径（基础 / 方法 / 实战），路径、技能雷达、复习卡、情境练习、资料库、作品集、检索**全站与主题严格一致**，主题之间内容互不串台 |
| 可解释的证据链 | 每个学习节点挂载 A/B/C 分级的公开资料证据，来源可点开核验（api 模式经 Tavily 实时联网检索） |
| 费曼学习闭环 | 基于节点生成练习对话：AI 追问 → 自评 → 间隔复习卡（SM-2 风格），自评计入技能证据 |
| 个人资产可恢复 | 资料库（资源收藏 / 链接 / 文件 / 笔记）、作品集、复习进度随学习者持久化 |
| 演示零密钥 | demo 模式无需任何密钥即可运行，全部内容诚实标注「演示数据」，不冒充真实结果 |

## 在线体验步骤

1. 打开 https://site-seven-weld-91.vercel.app ，登录页一键选择演示角色
2. 推荐「新学习者 · 林然」→ 进入目标诊断，输入一个学习主题（如「高中生物」）并确认
3. 观察首页 / 路径 / 技能雷达 / 复习 / 情境练习 / **个人资料库** / 作品集 / 检索**全部跟随该主题生成**
4. 在资料库新增一条链接，刷新页面仍在（演示数据持久化于浏览器）

## 截图

> 占位：可用 `npm run dev` 启动后浏览器截图，替换下表条目。

| 页面 | 截图 |
|---|---|
| 首页（主题化学习进度） | 待补充 |
| 知识树 / 节点证据抽屉 | 待补充 |
| 费曼练习对话 | 待补充 |
| 个人资料库 | 待补充 |

## 技术栈

- **框架**：Next.js 16.2.10（App Router）+ React 19 + TypeScript strict
- **样式**：Tailwind CSS v4（CSS-first `@theme` 设计系统），响应式（桌面 1200px 内容区 / 390px 移动端抽屉侧栏）
- **状态**：`useSyncExternalStore` 手写 AppStore，零状态库依赖
- **后端（api 模式）**：PostgreSQL 16 + Drizzle ORM、Redis、MinIO（对象存储）、HttpOnly Cookie 会话认证（JWT + bcrypt）
- **AI**：DeepSeek（Anthropic 兼容端点）结构化输出 + Mock 降级；证据检索经 Tavily 实时联网
- **测试**：tsx + Playwright 驱动的 E2E 套件（见「测试与验收」）

## 双模式架构

`NEXT_PUBLIC_DATA_SOURCE` 控制数据源，两种模式共享同一套页面组件与 Provider 抽象：

| | demo 模式（默认） | api 模式 |
|---|---|---|
| 数据 | 客户端确定性生成的主题数据包（`lib/demo/topic.ts`） | PostgreSQL + Drizzle（11+ 表，Drizzle schema） |
| AI | Mock Provider（确定性回复，零外发请求） | DeepSeek 真实调用（仅服务端 Route Handler） |
| 证据 | 派生资源卡片 | Tavily 实时检索 + A/B/C 分级 |
| 隔离 | 按主题隔离（跨主题 Jaccard < 0.2） | `user_id` + `path_id` 双键隔离，跨用户 404 |
| 门槛 | 零密钥、零数据库，开箱即用 | 需有效密钥 + 托管 Postgres |

设计要点：api 模式的选择器签名与 demo 模式完全一致，`lib/ai/*` Provider 抽象与 `lib/path/service.ts` 派生逻辑为两模式共用，保证前端组件零分叉。

## 本地运行

```bash
cd pathfinder/site
npm install        # 首次
npm run dev        # 开发：http://localhost:3000（默认 demo 模式，零配置）
```

构建与预览：

```bash
npm run build && npm start
```

演示角色（登录页或 URL `?role=` 切换，会持久化到 localStorage）：

| 角色 | 说明 |
|---|---|
| 新学习者 · 林然 | 无路径，注册 / 诊断 / 主题路径确认（主题一致性核心演示路径） |
| 在学学习者 · 陈思 | 已有学习进度与当前节点 |
| 练习中学习者 · 周宁 | 未完成费曼会话 + 本地草稿 |
| 内容管理员 · 陈岚 | 资源审核队列（角色数据隔离） |
| 机构管理员 · 张磊 | 仅本机构脱敏聚合数据 |

## 接入真实 AI（可选）

demo 模式默认走 Mock。接入 DeepSeek（Anthropic 兼容端点）：

```bash
cp .env.example .env.local
```

```
DEEPSEEK_ENABLED=true
DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic
DEEPSEEK_API_KEY=<你的令牌>
DEEPSEEK_MODEL=deepseek-chat
```

安全规则：**真实密钥只写入 `.env.local`（已 gitignore，绝不提交）**；密钥只在服务端 Route Handler 读取，客户端 bundle / 页面 / 日志中均不含密钥；若密钥曾泄露，请立即撤销并重签。

## 测试与验收

以生产构建（`next build && next start`）为基础的 E2E 套件，断言全绿：

| 套件 | 断言 | 覆盖 |
|---|---|---|
| `e2e-tmp/demo-topic-e2e.ts` | 51/51 | 三主题（高中生物 / Python 数据分析 / 摄影）全模块主题一致、**零 PM 词泄漏**、主题隔离 Jaccard < 0.2、跨主题 id 零重叠 |
| `e2e-tmp/module-isolation-e2e.js` | 95/95 | api 模式用户/路径隔离、新用户空库硬不变量、收藏 201 幂等、跨用户 404、两主题 Jaccard < 0.2 |
| `e2e-tmp/theme-e2e.js` | 123/123 | P1/P2 三主题全链路：真实 Tavily 检索、节点/资源/卡片/情境主题特异性 |
| `e2e-tmp/api-mode.js` | 28/28 | api 模式浏览器全链路 |
| `e2e-tmp/run.js` | 8 链路 / 112 断言 | demo 全功能验收：注册→诊断→路径→费曼→评价→复习→多路径→作品集→开关→租户/角色隔离 |
| `npx tsc --noEmit` | 0 错误 | api 与 demo 双态构建均全绿 |

套件全部保留于 `e2e-tmp/`，可复跑。验收过程中修复的真实问题（生产水合错误、死链、demo 数据跨主题泄漏）均记录于 git 历史。

## 页面地图（P0–P2，30+ 路由）

- **P0 主闭环**：`/` 落地页 · `/login` `/register` · `/onboarding` 目标诊断 · `/home` 学习首页 · `/path` 知识树 · `/path/nodes/[nodeId]` 节点详情 + 证据抽屉 · `/practice/[sessionId]` 费曼练习 · `/notes` 费曼笔记
- **P1 强化学习**：`/review` 复习中心 · `/labs` 情境练习 · `/skills` 技能雷达 · `/library` 个人资料库 · `/admin/content` 内容运营台
- **P2 空间与协作**：`/space` 学习空间 · `/paths` 多路径 · `/crews` 小队 · `/reviews/[reviewId]` 同伴反馈 · `/portfolio` 作品集 · `/search` 语义检索 · `/org/[tenantSlug]` 机构空间

功能开关关闭时隐藏对应导航、直访显示「功能暂未开放」**绝不返回 404**；角色不符显示 403 并说明原因，不泄露数据。

## 已知限制（诚实声明）

- **demo 模式**为前端演示：练习会话、草稿、设置存于浏览器 localStorage，刷新不丢失但不做多端同步；AI 编排与语义检索为确定性模拟。
- **线上站点**部署的是 demo 模式（免注册即看）；真实 api 模式需要有效密钥 + 托管数据库，未部署公网。
- 机构聚合数据为脱敏演示数据，不反映真实学习者。
