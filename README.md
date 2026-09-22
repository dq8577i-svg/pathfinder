# 知径 Pathfinder DemoZ V2

知径是一个面向自主学习者的 AI 个性化学习路径工作台。用户输入自己想学的任意主题、目标、基础和可投入时间，系统生成可执行、可解释、可持续迭代的学习路径；「AI 产品经理」是内置的 19 节点策展模板之一，不是产品唯一主题。

本目录是对 `pathfinder/site` 与 `pathfinder copy/site` 审计后的独立交付版，原目录不作为本版本运行依赖。

## 产品定位与差异化

知径不把 AI 当作聊天入口，而是把它放在学习任务链路中：

`目标诊断 → 路径编排 → 证据学习 → 费曼练习 → 复习反馈 → 能力与作品沉淀`

| 设计 | 解决的问题 | 微创新 |
|---|---|---|
| 任意主题目标诊断 | 用户已有想法，却只能从固定课程中选择 | 由用户定义主题、目标、基础、时间和期限，AI 负责结构化编排 |
| 策展模板 + AI 生成双轨 | 完全自由生成可能不稳定，固定课程又不够个性化 | 产品经理主题复用审核过的 19 节点模板，其他主题走可扩展 Provider |
| 多路径工作台 | 用户往往同时学习多个主题，单一路径会覆盖旧进度 | 每条路径独立保存，可新增、切换“当前路径”，首页及学习模块同步切换 |
| 节点证据卡 | 学习资料来源不透明 | 来源分级、可跳转、可解释，不用“AI 说了算” |
| 费曼追问 | 看完不等于学会 | 把复述、追问、自评、复习卡连接成闭环 |
| 学习资产恢复 | 聊天记录难以复用 | 资料、笔记、进度和作品按用户与路径持久化 |
| 五角色一键体验 | 评审难以快速看到完整产品 | 新学员、在学学员、练习学员、内容管理员、机构管理员各有状态与权限 |

首页和介绍页不再把产品定义为“AI 产品经理课程”。用户可以直接输入 Python 数据分析、摄影、日语口语、产品经理等主题；产品经理模板继续承担高质量示例与策展内容入口。

## 已实现范围

- 任意主题输入、四步目标诊断、路径预览与确认
- 多路径创建、独立保存、当前路径切换及跨页面同步
- 19 节点产品经理策展模板（可选主题）与通用 AI/Mock 编排
- 首页、知识树、节点详情、证据资料、费曼练习、笔记、复习中心
- 情境练习、技能雷达、个人资料库、作品集、检索、多路径与协作界面
- demo/api 双数据模式
- 五角色一键登录；api 模式使用服务端会话与 HttpOnly Cookie
- DeepSeek 服务端调用与 Mock 降级；客户端不接触模型密钥
- PostgreSQL 业务数据、Redis 限流、MinIO 文件上传与短时下载链接
- 存活检查与依赖就绪检查、上传所有权校验、输入约束、安全响应头
- 桌面端与移动端响应式布局

P2 中的小队实时协作、机构运营闭环和真正的向量语义检索仍是界面/协议预留，不应视为已生产化的能力。当前检索实现是 PostgreSQL 文本匹配。

## 目录说明

| 路径 | 内容 |
|---|---|
| `app/` | Next.js 页面与 Route Handlers |
| `components/` | 通用交互与布局组件 |
| `lib/` | AI、认证、数据源、领域服务和基础设施适配 |
| `db/` | Drizzle schema 与迁移 |
| `scripts/` | 数据库种子等工程脚本 |
| `tests/e2e/` | 主题一致性、demo 与 api 验收脚本 |
| `docs/` | 产品审计、实施契约和交付报告 |

## 快速体验：零基础设施 demo

环境要求：Node.js 20+，建议 Node.js 22。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。默认 `NEXT_PUBLIC_DATA_SOURCE=demo`，无需数据库、Redis、MinIO 或外部 API 密钥。

## 完整前后端：Docker Compose

先复制环境模板并按需修改：

```powershell
Copy-Item .env.example .env
docker compose up --build
```

启动后：

- Web：`http://localhost:3000`
- MinIO API：`http://localhost:9000`
- MinIO Console：`http://localhost:9001`
- PostgreSQL：`localhost:5432`
- Redis：`localhost:6379`

Compose 会等待 PostgreSQL、Redis、MinIO 就绪，创建对象存储桶，并在应用启动前执行数据库迁移与幂等种子数据。

如果基础设施已经在本机运行、只需要重建并启动 Web，请确保构建时就指定真实数据模式：

```dotenv
NEXT_PUBLIC_DATA_SOURCE=api
```

然后执行 `npm run build` 与 `powershell -ExecutionPolicy Bypass -File .\scripts\start-local-api.ps1`。`NEXT_PUBLIC_*` 会在 Next.js 构建时固化，仅在启动脚本里临时设置并不能改变已经生成的客户端包。

API 模式的一键角色登录只在 `ALLOW_DEMO_LOGIN=true` 时开放，正式环境必须关闭。生产环境还应更换全部默认密码、启用 HTTPS，并将 `COOKIE_SECURE` 设为 `true`。

## 外部模型与搜索

服务端读取以下配置；不要把真实密钥写入代码、提交到 Git 或暴露到 `NEXT_PUBLIC_*` 变量：

```dotenv
DEEPSEEK_ENABLED=true
DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic
DEEPSEEK_API_KEY=replace_me
DEEPSEEK_MODEL=deepseek-chat
TAVILY_API_KEY=replace_me
```

未启用 DeepSeek 时，demo 模式使用确定性的 Mock 返回。API 模式对 AI 接口要求登录并使用 Redis 限流；生产环境 Redis 不可用时按失败关闭处理。

## 验证命令

```bash
npm run typecheck
npm run lint
npm run build
npm run test:topic
npm run test:e2e:demo
npm run test:e2e:infra
npm run test:e2e:api
npm run test:e2e:paths
docker compose config --quiet
```

`test:e2e:demo` 需要 demo 模式构建和已启动的生产服务器。API 模式启动后，
`test:e2e:infra` 验证 PostgreSQL、Redis、MinIO、文件权限和 AI 接口，
`test:e2e:api` 验证注册到学习资产恢复的完整浏览器流程，
`test:e2e:paths` 验证多路径管理、真实 PATCH 写库、筛选看板、表单、持久化与响应式体验。

健康检查：

- `GET /api/v1/health/live`：仅判断应用进程是否存活
- `GET /api/v1/health/ready`：检查 PostgreSQL、Redis、MinIO；关键依赖未就绪时返回结构化 `503`

## 安全与部署边界

- 上传默认限制 10 MB，仅允许配置的 MIME 类型；对象键按用户和路径隔离。
- 文件下载先校验资源归属，再签发 5 分钟有效的 MinIO 预签名链接。
- API AI 聊天校验请求大小、消息条数、温度和 token 上限，并按用户/IP 限流。
- demo 数据用于体验，不等于真实教学效果或生产数据。
- 如历史密钥曾出现在日志、文档或提交中，必须在提供商控制台撤销并重新签发。

更多详情见 [当前产品审计与 DemoZ V2 改进方案](docs/当前产品审计与DemoZ-V2改进方案.md) 和 [实施契约](docs/IMPLEMENTATION-CONTRACT.md)。
