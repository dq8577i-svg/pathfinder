# 知径 Pathfinder：Agent 路径生成架构与真实 Provider 接入说明

> 更新时间：2026-09-13  
> 状态：P0 已接入并通过真实链路验收；异步 Worker、正文解析与混合检索列入下一阶段。

## 1. 本次完成范围

- 经用户明确授权，使用旧项目本地保存的 DeepSeek 与 Tavily 密钥；密钥全文未写入代码、日志或本文档。
- 新版 `.env.local` 仅保存 Provider 配置，已被 `.gitignore` 排除。
- DeepSeek 负责学习目标理解、技能/周计划编排、检索词规划、费曼追问和三维评价。
- Tavily 负责真实公开网络检索；模型不输出或伪造 URL。
- 路径确认前展示真实候选来源、检索 Provider、查询词、证据覆盖摘要和规则计算的可信度。
- Redis 保存当前用户的 30 分钟短期预览快照，确认时复用用户实际看到的方案，避免二次模型调用产生节点漂移。
- 用户确认后自动重新检索、去重并把资源元数据写入 PostgreSQL。
- 修复 DeepSeek 评价字段偶发使用 `score/rating/中文评分字段` 导致降级 Mock 的兼容问题；仍缺少真实分数时继续拒绝，不凭空填默认值。

## 2. 当前运行链路

```text
用户目标诊断
  → DeepSeek 生成候选技能与周计划
  → 查询规划 Agent 生成中英文语义查询词
  → Tavily 实时检索公开候选资料
  → 服务端按来源等级、相关度和 URL 去重
  → 确认页展示路径依据与可信度
  → Redis 保存用户看到的预览快照（TTL 30 分钟）
  → 用户明确确认
  → 服务端复用快照中的节点与顺序创建路径
  → Tavily 重新检索并持久化资源元数据
  → PostgreSQL 保存路径、节点、来源与证据覆盖
```

## 3. Agent 边界

当前采用“确定性工作流 + 有边界的模型决策”，不是无限自主循环。

| 环节 | Agent/工具 | 可决定 | 不可决定 |
| --- | --- | --- | --- |
| 学习规划 | DeepSeek Planner | 技能名、理由、周计划 | 数据库 ID、用户权限、外部 URL |
| 查询规划 | DeepSeek Query Planner | 中英文查询词、资料意图 | 伪造搜索结果、绕过搜索服务 |
| 网络检索 | Tavily Provider | 返回公开链接和摘要 | 直接写入路径、声称人工认证 |
| 证据筛选 | 服务端规则 | 去重、分级、覆盖率 | 将无证据节点标成高可信 |
| 路径确认 | 用户 | 接受、返回调整 | 无确认自动发布 |
| 持久化 | Path/Resource Service | 确定性 ID、归属、状态 | 接受客户端传入 user_id |

## 4. 可信度规则

- `high`：已检索核心节点中，至少 80% 有 A/B 级候选来源。
- `medium`：至少 50% 有 A/B 级候选来源。
- `low`：不足 50%，或搜索 Provider 未配置。
- 可信度由证据覆盖规则计算，不采用模型自报百分比。
- A/B/C 目前仍是机器初筛，不等于人工认证；外链可访问性逐条复验、正文质量评分和专家抽检尚未进入本阶段。

## 5. 前后端接口变化

### 路径预览

`POST /api/v1/paths/preview`

- 返回真实 DeepSeek 规划结果。
- 返回 `searchQueries`、`evidenceCoverageSummary`、`evidenceConfidence`。
- 节点中包含 Tavily 候选 `resources`。
- 服务端将预览按 `userId + previewId` 写入 Redis。

### 路径确认

`POST /api/v1/paths/confirm`

推荐请求：

```json
{
  "goal": "LearningGoalInput",
  "previewId": "preview-xxxxxxxx"
}
```

- 只读取当前登录用户自己的预览快照。
- 校验主题、目标、水平、时间和周期与预览一致。
- 快照存在且一致时复用；缺失时安全回退为服务端重新规划。
- 快照消费后删除，避免重复确认。

### 资料刷新

`POST /api/v1/paths/:pathId/resources/refresh`

- 查询规划 Agent 为整条路径批量生成查询词。
- Tavily 检索、URL 去重、类型限制和 A/B/C 初筛。
- 更新节点证据覆盖与路径级证据摘要。

## 6. 数据与基础设施职责

| 组件 | 当前职责 | 下一阶段 |
| --- | --- | --- |
| PostgreSQL | 用户、路径、节点、资源、练习、评价、证据摘要 | 增加 agent_runs、agent_steps、tool_calls、usage_ledger |
| Redis | 限流、路径预览快照 | BullMQ 任务队列、Agent checkpoint、SSE 进度事件 |
| MinIO | 已就绪 | PDF、网页快照、视频字幕和用户附件 |
| DeepSeek | 结构化规划、查询扩展、对话、评价 | 证据摘要、路径质量审查、动态重规划 |
| Tavily | 公开网络候选发现 | 多 Provider 联合召回与用量路由 |

## 7. 当前验收结果

- Tavily 真实搜索：HTTP 200，可返回中国大学 MOOC、Coursera、Bilibili、知乎等中外来源。
- M5 真实 Provider/Agent 验收：27/27。
- 浏览器 API E2E：36/36。
- DeepSeek 状态：`provider=deepseek`、`model=deepseek-chat`、`isDemo=false`。
- PostgreSQL、Redis、MinIO：全部 `ready`。
- Lint、TypeScript、Next.js production build：通过。
- 浏览器 DOM、脚本和日志未发现 `sk-` 密钥泄漏。

## 8. 下一阶段建议

1. 将当前同步路径生成升级为 BullMQ Worker + SSE，支持取消、重试、断点恢复和真实步骤进度。
2. 增加合规 Content Fetcher，解析公开网页正文、PDF 元数据与公开视频字幕；不绕过登录、付费墙和 robots。
3. 为 PostgreSQL 增加 pgvector，完成关键词 + 向量 + 来源权重的混合召回与语义去重。
4. 接入 OpenAlex、Crossref、Semantic Scholar、公开课等专业数据源，不将 Tavily 等同于“全部数据库”。
5. 增加 URL 可访问性复验、内容时效、难度匹配、交叉来源一致性和专家抽检。
6. 增加 Agent 运行成本、Token、搜索次数、失败率和用户采纳率监控。

## 9. 已知边界

- 当前是“真实搜索候选 + 机器证据初筛”，不是全网爬虫，也不是人工认证课程库。
- 路径生成仍通过同步 HTTP 完成，复杂主题或外部 Provider 较慢时可能等待几十秒。
- Tavily 的中国内容覆盖由其搜索索引决定，需要后续增加中文专业来源适配器。
- 当前保存链接与必要元数据，不保存未经授权的资料全文。
