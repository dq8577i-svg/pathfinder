# 知径 Pathfinder DemoZ V2：API 真实链路补充验收

> 验收时间：2026-09-13  
> 验收目录：`D:\ClaudeWorks\task-gupiao\pathfinder-demoz-v2`

## 1. 结论

在 Docker Desktop 仍被其损坏的 `dockerInference` 临时 Socket 阻断的情况下，已使用 WSL 内真实运行的 PostgreSQL 14、Redis 6 和 MinIO RELEASE.2025-09-07T16-13-09Z 完成数据层替代验收。

这次测试证明了“前端 → Next.js Route Handler → PostgreSQL / Redis / MinIO → 前端”的真实链路可用；但不能替代 PostgreSQL 16、Redis 7、MinIO Compose 镜像及应用容器本身的最终 Docker 验收。

AI 验收使用服务端 Mock Provider，因为新目录没有复制历史密钥，也没有可使用的 DeepSeek 测试令牌。鉴权、请求链路、持久化和错误处理已验证，DeepSeek 供应商响应仍需在提供新令牌后单独验收。

## 2. 本轮新增修复

### 2.1 任意主题与策展模板双轨

问题：早期版本把产品经理教材误写成产品唯一入口，与“用户输入自己想学的主题”这一核心需求冲突。

修复：

- 首页、介绍页和创建页统一为任意主题入口，不再默认填写产品经理。
- 用户输入命中“产品经理”时复用已审核的 19 节点教材；其他主题由 Provider 按目标生成路径。
- 第一条路径为主路径，第二条及以后作为并行路径写入 PostgreSQL，不再返回“已有主路径”冲突。
- 新创建路径成为客户端当前路径；用户可在路径列表切换，首页和学习模块共同读取该选择。

### 2.2 API E2E 更新

浏览器脚本已按最新产品合同验证：

- 用户输入“Python 数据分析”后生成对应主题路径；
- 再创建“摄影”路径，两条记录同时保留；
- 当前路径可以切换，`/path` 不混入产品经理固定节点；
- 服务端 Provider 不把 Mock 伪装成真实 DeepSeek。

### 2.3 基础设施专项测试

新增 `tests/e2e/api-infra.js`，覆盖：

- live/ready；
- PostgreSQL、Redis、MinIO 就绪；
- AI 匿名访问拒绝；
- 非法角色拒绝；
- 五角色服务端会话；
- 路径归属；
- 上传 MIME 与越权校验；
- MinIO 上传、预签下载及内容一致性；
- 跨用户文件隔离；
- PostgreSQL 元数据；
- Redis 限流窗口。

## 3. 验收结果

| 测试 | 结果 | 说明 |
|---|---:|---|
| 数据库迁移 | 通过 | 5 份迁移成功应用 |
| Seed 对拍 | 通过 | 5 用户、19 节点及主要演示数据全部达到基线 |
| API 基础设施 E2E | 24/24 | 0 失败，含真实 429 限流 |
| 任意主题专项测试 | 51/51 | 3 个不同主题、主题隔离与稳定 ID |
| Demo 浏览器 E2E | 8/8 链路，110/110 | 0 失败，含双路径创建与切换 |
| API 浏览器 E2E | 34/34 | 0 失败，含 PostgreSQL 双路径持久化 |
| ESLint | 通过 | 0 error / 0 warning |
| TypeScript | 通过 | 0 error |
| API 模式生产构建 | 通过 | Next.js 静态生成 44/44 |

API 浏览器主链路：

`注册 → 输入任意主题 → 路径预览/确认 → 创建第二条路径 → 切换当前路径 → 对应主题知识树 → 节点 → 5 轮费曼练习 → AI 评价 → 笔记 → 学习空间 → 刷新恢复 → 退出 → 未登录门禁`

## 4. Docker Desktop 状态

尝试了以下非破坏性修复：

1. 重启 Docker Desktop；
2. 关闭与本项目无关的 Docker AI/Inference 功能；
3. 重新检查 WSL 与 Docker 服务状态。

Docker 仍在初始化 Inference manager 时访问损坏 Socket 失败：

`C:\Users\DQ857\AppData\Local\Docker\run\dockerInference`，Windows 错误码 1920。

自动删除该临时 Socket 被安全策略阻止；没有执行恢复出厂设置，也没有删除镜像、容器或数据卷。

## 5. 当前运行入口

API 模式当前可通过以下地址体验：

- Web：`http://localhost:3000`
- 登录：`http://localhost:3000/login`
- MinIO Console：`http://localhost:9001`

演示账号通过登录页五角色按钮由后端签发会话，不需要输入预置密码。

## 6. 仍需完成

1. 用户确认后修复 Docker 临时 Socket或执行 Docker Desktop Repair；恢复出厂设置前必须备份卷。
2. 执行 `docker compose up --build -d`，验证目标 PostgreSQL 16 / Redis 7 / MinIO 镜像。
3. 执行 `npm run test:e2e:infra` 和 `npm run test:e2e:api` 复验容器环境。
4. 提供新的 DeepSeek 测试令牌后，开启 `DEEPSEEK_ENABLED=true`，增加供应商超时、结构化输出和降级验收。

## 7. WSL 验证环境说明

为完成真实数据层验证，本轮在现有 Ubuntu 22.04 WSL 中安装/启动了 PostgreSQL、Redis，并下载 MinIO 二进制到 `/usr/local/bin/minio`；测试数据位于 PostgreSQL 的 `pathfinder` 数据库和 `/var/lib/pathfinder-minio`。这些服务仅用于本机验收，不是最终交付部署方式。
