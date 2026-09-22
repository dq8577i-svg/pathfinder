# 知径 Pathfinder 双主题首页 Design QA

## 验收范围

- 目标界面：用户选定的「Graphite Command Center」方向 3。
- 页面：学习首页 `/home`，同时覆盖全局导航、路径切换器、当前任务、节点序列、AI 学习助手与快捷操作。
- 主题：暗色与浅色分别设计，不采用简单色值反转。
- 视口：桌面端 `1440 × 1024`；移动端 `390 × 844`。
- 数据约束：实现截图使用真实 API 用户及其真实路径数据，因此节点数量、资源数量和姓名可与概念稿不同。

## 同输入视觉对照

以下对照图均将目标稿置于左侧、实现截图置于右侧，并使用同一页面状态：路径菜单展开、后续节点悬停、AI 助手展开。

| 主题 | 全页对照 | 中央任务区 | AI 助手区 |
| --- | --- | --- | --- |
| 暗色 | [comparison-home-dark.png](docs/design-qa/comparison-home-dark.png) | [comparison-home-dark-center.png](docs/design-qa/comparison-home-dark-center.png) | [comparison-home-dark-assistant.png](docs/design-qa/comparison-home-dark-assistant.png) |
| 浅色 | [comparison-home-light.png](docs/design-qa/comparison-home-light.png) | [comparison-home-light-center.png](docs/design-qa/comparison-home-light-center.png) | [comparison-home-light-assistant.png](docs/design-qa/comparison-home-light-assistant.png) |

## 视觉结论

| 维度 | 结果 | 说明 |
| --- | --- | --- |
| 信息架构 | 通过 | 顶部命令栏、左侧工作区导航、中央学习任务、右侧 AI 助手与目标稿一致。 |
| 暗色语言 | 通过 | 石墨黑画布、半透明分层、局部青色辉光与紫色 AI 标识形成高对比但不过度发光。 |
| 浅色语言 | 通过 | 暖白画布、实体白卡、柔和投影与低饱和青绿色建立层级，没有照搬暗色玻璃辉光。 |
| 字体与层级 | 通过 | 大标题、任务标题、元信息和辅助说明形成稳定的四级信息层级。 |
| 布局与密度 | 通过 | 桌面端保留专业工作台密度；移动端退化为单列任务流并隐藏右侧助手。 |
| 动态反馈 | 通过 | 主按钮有克制扫光，卡片有悬停抬升，路径节点提供预览，主题切换有平滑过渡。 |
| 真实性 | 通过 | 内容由登录用户的真实路径和资源数据驱动，未为了截图伪造目标稿中的节点数量。 |

## 问题历史与修复

| 级别 | 第一轮发现 | 修复 | 复验 |
| --- | --- | --- | --- |
| P2 | 节点学习时长显示为“300 分钟”，阅读成本高。 | 统一调用 `formatMinutes`，改为“5 小时”等自然语言。 | 暗色、浅色及移动端截图均通过。 |
| P2 | 新视觉将进度数字拆成视觉组件，旧 E2E 无法读取“4/19 节点”。 | 增加屏幕阅读器专用的完整进度文本，不改变视觉布局。 | Demo 全链路恢复 8/8、110/110。 |
| P2 | 移动端可能因三栏桌面布局产生横向滚动。 | 右侧助手在小屏隐藏，中央内容单列化，顶部导航转为抽屉入口。 | 390px 下 `scrollWidth === clientWidth`。 |

## 自动化验收

- 设计交互：8/8，通过主题切换、`Ctrl+K` 命令面板、多路径菜单、AI 助手 Tab/收起及移动端无溢出。
- Demo E2E：8/8 主链路，110/110 断言；无死链、无页面异常、无失败请求、无令牌泄漏。
- API E2E：34/34；覆盖注册、任意主题生成、多路径保留与切换、练习、评价、笔记、刷新会话与退出鉴权。
- 主题隔离：51/51；高中生物、Python 数据分析和摄影路径不存在固定 AI 产品经理内容污染。
- 生产依赖审计：0 个已知漏洞。
- Lint、TypeScript、Next.js 生产构建：通过。

## 最终结果

passed
