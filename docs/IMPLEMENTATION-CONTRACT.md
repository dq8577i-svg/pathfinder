# 知径 Pathfinder DemoZ V2｜实施契约

> 状态：冻结用于本轮前后端联调。若代码与本文冲突，以本文和自动化验收共同裁决。

## 1. 产品边界

- 用户可输入任意学习主题；主题、具体目标、现有基础、每周时间与期限共同构成规划输入。
- `AI 产品经理基础能力路径` 是以现有 19 个教材节点构成的策展模板，不是产品边界；其他主题由 AI Provider 编排并标注来源/降级状态。
- 同一用户可创建多条路径。第一条自动成为主路径；后续路径并行保存，不覆盖既有进度。客户端“当前路径”选择同步影响首页、知识树、练习、复习、资料与作品模块。
- 核心闭环：诊断 → 路径 → 证据 → 费曼练习 → 反馈/笔记 → 复习/下一步。
- 任意主题编排属于当前可体验范围，但不得宣称所有主题与人工策展模板具有同等内容质量。
- Demo 数据必须标注；API 模式不得从 `lib/demo/*` 读取普通用户业务数据。

## 2. 运行模式

| 模式 | 数据源 | AI/搜索 | 用途 |
|---|---|---|---|
| `demo` | 浏览器本地确定性数据 | Mock，明确标注 | 零配置评审 |
| `api` | PostgreSQL + Redis + MinIO | DeepSeek/Tavily，可降级 | 前后端真实联调 |

## 3. 本轮新增 API

| 方法与路由 | 请求 | 成功响应 | 权限/约束 |
|---|---|---|---|
| `POST /api/v1/auth/demo-login` | JSON `{role}` | `200 {data:{user},meta}` | 仅 `ALLOW_DEMO_LOGIN=true`，仅 5 个 seed 角色 |
| `POST /api/v1/library/upload` | multipart：`pathId,file,title?,sourceName?,tags?,memo?` | `201 {data:{item},meta}` | 登录；路径属于本人；白名单 MIME；默认 ≤10 MB |
| `GET /api/v1/library/:id/download` | 无 | `200 {data:{url},meta}` | 登录；条目属于本人；短时预签名 URL |
| `GET /api/v1/health/live` | 无 | 进程存活 | 不访问依赖 |
| `GET /api/v1/health/ready` | 无 | PostgreSQL/Redis/MinIO 组件状态 | 不返回地址、口令或令牌 |

## 4. 统一错误与安全

- 业务 API 使用 `{data,meta}` / `{error}` 信封；HTTP status 不得被 meta 吞掉。
- 服务端从会话解析 `userId`，不接受客户端 userId。
- 上传对象键至少包含 `userId/pathId`，下载前再次查库验证所有权。
- 真实 AI 入口必须认证、校验输入大小，并经 Redis 限流；Redis 故障在本地可降级但需被 readiness 标记。
- 任何 `.env.local`、旧 DeepSeek/Tavily/Vercel token 都不得复制到本目录。

## 5. 完成定义

1. `npm run typecheck`、`npm run build` 通过。
2. 任意主题、主题隔离、多路径创建/保留/切换、策展教材模板测试和浏览器主链路通过。
3. Docker 可用时，Compose 启动后 `live` 与 `ready` 通过。
4. API 模式完成：一键角色登录 → 首页 → 路径/节点 → 费曼练习 → 评价/笔记；文件上传 → 列表 → 预签下载。
5. 所有页面无 404、白屏、阻断 console error；桌面 1440px 与移动 390px 无横向溢出。
