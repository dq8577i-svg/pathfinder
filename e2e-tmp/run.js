// 知径 Pathfinder E2E acceptance runner (8 chains)
const { launch, Chain } = require("./lib");

const browserP = launch();
let results = [];

// ---- Mock Feynman reply predictor (mirror lib/ai/mock.ts) ----
const FEYNMAN_QUESTIONS = [
  "能用你自己的话，把「表象需求」和「真实需求」各举一个例子讲清楚吗？",
  "如果用户坚持要「一键导出」这个按钮，你会用什么方法确认他背后的真实任务是什么？",
  "要写出一条可验证的需求假设，成功标准应该怎么定？验证失败时回退的判断又是什么？",
  "这条假设和你当前节点的能力目标有什么关系？完成它需要具备哪些前置知识？",
  "用你自己的话总结一下：这个节点最重要、最想让我记住的一个概念是什么？",
];
function feynmanReply(last, topic = "从表象需求到真实需求") {
  let h = 0;
  const s = last + topic;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return FEYNMAN_QUESTIONS[h % FEYNMAN_QUESTIONS.length];
}

function assert(c, ok, label, detail = "") {
  c.ok(ok, label, detail);
}

async function runChain(name, fn) {
  const browser = await browserP;
  const c = new Chain(browser, name);
  await c.start();
  try {
    await fn(c);
  } catch (e) {
    c.ok(false, "CHAIN EXCEPTION", e.message + (e.stack ? " :: " + e.stack.split("\n")[1] : ""));
  }
  const summary = {
    name,
    pass: c.assertions.filter((a) => a.ok).length,
    fail: c.assertions.filter((a) => !a.ok).length,
    assertions: c.assertions,
  };
  results.push(summary);
  await c.close();
  console.log(`[${summary.pass}/${summary.pass + summary.fail}] ${name}`);
  for (const a of c.assertions.filter((x) => !x.ok)) console.log(`   FAIL: ${a.label} ${a.detail}`);
  return c;
}

/* ================= Chain 1 ================= */
async function chain1(c) {
  await c.goto("/");
  await c.waitForHydration();
  await c.waitForText("把产品经理教材");
  assert(c, await c.hasText("学习闭环"), "L1 落地页含学习闭环");
  assert(c, await c.hasText("开始学习"), "L1 落地页 CTA 开始学习");
  assert(c, await c.hasText("演示数据"), "L1 落地页演示数据标识");

  await c.clickText("开始学习");
  await c.waitForText("创建账号，开始你的学习路径");
  await c.type("#reg-name", "林然");
  await c.type("#reg-email", "linran@example.com");
  await c.type("#reg-password", "Passw0rd!");
  await c.type("#reg-confirm", "Passw0rd!");
  await c.click("#reg-agree");
  await c.clickText("创建并开始规划");
  await c.waitForText("创建你的学习路径", 20000);
  assert(c, c.url().includes("/onboarding"), "L1 注册后进入 /onboarding");

  // 4 步诊断（通用主题：主题→基础→时间→期限）
  await c.type("#topic", "Python 数据分析");
  await c.clickText("下一步");
  await c.waitForText("你目前的水平");
  await c.clickText("零基础");
  await c.clickText("下一步");
  await c.waitForText("你每周可以投入多少时间");
  await c.clickText("5 小时");
  await c.clickText("下一步");
  await c.waitForText("你希望在多长时间内完成");
  await c.clickText("6 周");
  await c.clickText("生成路径方案");

  // AI 编排阶段（通用阶段文案）
  await c.waitForText("AI 编排中");
  assert(c, await c.hasText("理解你的学习目标"), "L1 AI 编排阶段-理解目标");
  assert(c, await c.hasText("编排技能与周计划"), "L1 AI 编排阶段-编排技能");
  await c.waitForText("你的建议学习路径", 20000);
  assert(c, await c.hasText("Python"), "L1 结果标题围绕用户主题");
  assert(c, await c.hasText("按周计划"), "L1 结果含按周计划");
  assert(c, await c.hasText("技能拆解"), "L1 结果含技能拆解");
  assert(c, await c.hasText("第 1 周"), "L1 结果含第 1 周");
  assert(c, await c.hasText("AI 整理（演示）"), "L1 结果含 AI 整理（演示）标签");
  assert(c, await c.hasText("演示数据"), "L1 结果含演示数据标识");

  await c.clickText("确认此路径");
  const toast = await c.waitToast("学习路径已生成");
  assert(c, toast, "L1 确认路径 toast");
  await c.waitForText("你的学习路径", 15000);
  assert(c, c.url().includes("/home"), "L1 确认后返回 /home");
  assert(c, await c.hasText("已生成"), "L1 新学习者显示已生成路径卡片");
  assert(c, await c.hasText("进入路径"), "L1 路径卡片含进入路径");
  assert(c, await c.hasText("Python"), "L1 首页卡片含用户主题");
  const noEmpty = !(await c.hasText("还没有学习路径"));
  assert(c, noEmpty, "L1 不显示空态");

  // 期间无 500 / 空白 / 404
  const bad = c.httpErrors.filter((e) => e.status >= 500 || e.status === 404);
  assert(c, bad.length === 0, "L1 无 500/404", JSON.stringify(bad));
}

/* ================= Chain 2 ================= */
async function chain2(c) {
  await c.goto("/home?role=learner");
  await c.waitForHydration();
  await c.waitForText("继续学习");
  assert(c, await c.hasText("从表象需求到真实需求"), "L2 首页当前节点标题");
  assert(c, await c.hasText("4/19 节点"), "L2 进度 4/19");
  assert(c, await c.hasText("今日安排"), "L2 今日安排");

  await c.clickText("继续学习");
  await c.waitForText("能力目标");
  assert(c, await c.hasText("完成条件"), "L2 节点页完成条件");
  assert(c, await c.hasText("A 级"), "L2 节点页 A 级徽标");
  assert(c, await c.hasText("B 级"), "L2 节点页 B 级徽标");
  assert(c, await c.hasText("C 级"), "L2 节点页 C 级徽标");

  // 证据详情
  await c.clickText("详情 →", { index: 0 });
  await c.waitForText("校验时间");
  assert(c, await c.hasText("检索时间"), "L2 证据详情-检索时间");
  assert(c, await c.hasText("许可说明"), "L2 证据详情-许可");
  assert(c, await c.hasText("在新标签打开原站"), "L2 证据详情-来源URL");
  await c.clickText("关闭");
  await c.sleep(300);

  // 标记为完成 + 二次确认 + 撤销
  await c.clickText("标记为完成");
  await c.waitForText("确认你已经理解");
  await c.clickText("标记完成", { within: '[role="dialog"]' });
  const doneToast = await c.waitToast("已标记为完成");
  assert(c, doneToast, "L2 标记完成 toast");
  assert(c, await c.hasText("撤销完成"), "L2 完成后可撤销");
  await c.clickText("撤销完成");
  await c.waitForText("将把该节点恢复为未完成状态");
  await c.clickText("撤销完成", { within: '[role="dialog"]' });
  const undoToast = await c.waitToast("已撤销完成");
  assert(c, undoToast, "L2 撤销完成 toast");

  // 开始费曼练习
  await c.clickText("开始费曼练习");
  await c.waitForText("第 2 / 5 轮");
  assert(c, !(await c.hasText("主导航")), "L2 专注模式无侧边栏");
  assert(c, !(await c.hasText("演示控制台")), "L2 专注模式无顶栏工作台");

  // 输入区 Enter 发送 → AI 思考中 → Mock 回复
  const inputSel = 'textarea[aria-label="你的讲解"]';
  const msg1 = "我先区分表象诉求和底层任务，用户要的按钮可能只是方案。";
  await c.type(inputSel, msg1);
  await c.press("Enter");
  const thinkingSeen = await c.page.waitForFunction(
    () => document.body.innerText.includes("AI 思考中…"),
    { timeout: 3000, polling: 100 },
  ).then(() => true).catch(() => false);
  assert(c, thinkingSeen, "L2 AI 思考中可见片刻");
  await c.waitForText(feynmanReply(msg1), 20000);
  assert(c, await c.hasText("AI 整理（演示）"), "L2 Mock 回复带 AI 整理标注");

  // Shift+Enter 不发送
  const beforeShift = await c.page.evaluate((s) => document.querySelectorAll(s).length, "ol li");
  await c.type(inputSel, "换行测试第一行");
  await c.pressShiftEnter();
  await c.sleep(400);
  const afterShift = await c.page.evaluate((s) => document.querySelectorAll(s).length, "ol li");
  assert(c, beforeShift === afterShift, "L2 Shift+Enter 不发送");
  const inputVal = await c.page.$eval(inputSel, (el) => el.value);
  assert(c, inputVal.includes("换行测试第一行"), "L2 Shift+Enter 保留换行内容");

  // 连续对话至第 5 轮
  const msgs = [
    "我会问用户什么时候、多久导出一次，以及导出后拿去做什么，来判断底层任务。",
    "写成可验证假设：用户需要定期把筛选结果带走，验证方式是统计导出后分享链接的使用量。",
  ];
  for (const m of msgs) {
    await c.type(inputSel, m);
    await c.press("Enter");
    await c.waitForText(feynmanReply(m), 20000);
  }
  await c.waitForText("进入评价", 10000);
  assert(c, await c.hasText("已完成 5 轮讲解"), "L2 第5轮出现进入评价");

  await c.clickText("进入评价");
  await c.waitForText("练习尚未完成", 15000);
  assert(c, c.url().includes("/result"), "L2 进入评价跳转结果页");
  // 评价页演示：demo 数据将「已完成并获得评价」建模为独立会话 session-done-01
  await c.goto("/practice/session-done-01/result");
  await c.waitForText("费曼练习评价");
  assert(c, await c.hasText("这次你已经讲清"), "L2 三大判定-已讲清");
  assert(c, await c.hasText("仍待补充"), "L2 三大判定-待补充");
  assert(c, await c.hasText("尚未覆盖"), "L2 三大判定-未覆盖");
  assert(c, await c.hasText("完整性") && await c.hasText("准确性") && await c.hasText("清晰度"), "L2 三维度");
  assert(c, await c.hasText("4 / 5"), "L2 维度非百分比 (x/5)");
  assert(c, await c.hasText("为学习建议，不是能力认证"), "L2 置信提示");
  assert(c, await c.hasText("费曼笔记（可编辑）"), "L2 可编辑费曼笔记");
  await c.type('textarea[aria-label="笔记正文"]', "补充：基线需要先统计当前导出频率。");
  await c.clickText("保存笔记");
  const noteToast = await c.waitToast("笔记已保存");
  assert(c, noteToast, "L2 笔记保存 toast");
  await c.clickText("查看原对话");
  await c.waitForText("原始对话");
  assert(c, await c.hasText("原始对话"), "L2 原始对话抽屉");
  await c.clickText("返回首页");
  await c.waitForText("继续学习", 15000);

  // 退出练习确认对话框
  await c.goto("/practice/session-active-chen");
  await c.waitForText("第 2 / 5 轮");
  await c.click('[aria-label="退出练习"]');
  await c.waitForText("退出练习？");
  assert(c, await c.hasText("你的进度已保存为草稿"), "L2 退出确认对话框");
}

/* ================= Chain 3 ================= */
async function chain3(c) {
  await c.goto("/practice/session-unfin-zhou?role=practice_learner");
  await c.waitForHydration();
  await c.waitForText("第 3 / 5 轮");
  const draft = await c.page.$eval('textarea[aria-label="你的讲解"]', (el) => el.value);
  assert(c, draft.includes("底层任务可能是把筛选结果带到跨部门周报里"), "L3 本地草稿恢复在输入框", draft.slice(0, 60));
  assert(c, await c.hasText("仅本机·未同步"), "L3 顶部同步状态-仅本机未同步");

  // 切离线
  await c.goto("/practice/session-unfin-zhou?role=practice_learner&state=offline");
  await c.waitForHydration();
  await c.waitForText("未保存为已同步");
  const msgOff = "离线发送：我的草稿补充了验证基线。";
  await c.type('textarea[aria-label="你的讲解"]', msgOff);
  await c.press("Enter");
  await c.sleep(800);
  assert(c, await c.hasText("未同步"), "L3 离线消息标未同步");
  assert(c, await c.hasText("仅本机·未同步"), "L3 离线状态条保持仅本机未同步");
  const bt = await c.bodyText();
  assert(c, !bt.includes("已保存"), "L3 离线不出现已保存字样");
  const aiBubbles = await c.page.evaluate(() => {
    return Array.from(document.querySelectorAll("ol li")).filter((li) => li.textContent.includes("AI 整理（演示）")).length;
  });
  await c.sleep(1500);
  const aiBubbles2 = await c.page.evaluate(() => {
    return Array.from(document.querySelectorAll("ol li")).filter((li) => li.textContent.includes("AI 整理（演示）")).length;
  });
  assert(c, aiBubbles === aiBubbles2, "L3 离线无 AI 回复");

  // 恢复 normal（通过演示控制台）
  await c.click('[aria-label="演示控制台"]');
  await c.waitForText("演示状态");
  await c.clickText("正常");
  await c.sleep(300);
  await c.press("Escape");
  await c.sleep(300);
  assert(c, await c.hasText("同步消息与草稿"), "L3 恢复正常后出现同步操作");

  await c.clickText("同步消息与草稿");
  const syncToast = await c.waitToast("已同步");
  assert(c, syncToast, "L3 同步 toast 已同步");
  await c.sleep(500);
  assert(c, await c.hasText("已保存"), "L3 同步后状态已保存");
  assert(c, await c.hasText("已发送"), "L3 同步后消息已发送");
}

/* ================= Chain 4 ================= */
async function chain4(c) {
  // 复习
  await c.goto("/review?role=learner");
  await c.waitForHydration();
  await c.waitForText("复习中心");
  await c.waitForText("今日待复习");
  assert(c, await c.hasText("问题 · 点击查看答案"), "L4 复习卡片-问题面");
  await c.clickText("问题 · 点击查看答案");
  await c.waitForText("重来");
  assert(c, await c.hasText("答案 · 点击返回问题"), "L4 复习卡片翻面");
  assert(c, await c.hasText("困难") && await c.hasText("良好") && await c.hasText("轻松"), "L4 自评按钮");
  await c.clickText("良好");
  const reviewToast = await c.waitToast("已记录「良好」");
  assert(c, reviewToast, "L4 自评 toast");
  await c.sleep(300);
  assert(c, await c.hasText("已完成 1/"), "L4 进度更新");

  // 情境练习场
  await c.goto("/labs?role=learner");
  await c.waitForHydration();
  await c.waitForText("情境练习场");
  assert(c, await c.hasText("AI 扮演"), "L4 情境列表含 AI 扮演");
  assert(c, await c.hasText("初级") || await c.hasText("中级"), "L4 情境列表含难度");
  assert(c, await c.hasText("分钟"), "L4 情境列表含时长");

  // 已完成情境直接展示报告（卡片可见文案为中文标题，按链接选择器点击）
  const clickedPriority = await c.page.evaluate(() => {
    const link = document.querySelector('a[href="/labs/scenario-priority"]');
    if (link) {
      link.click();
      return true;
    }
    return false;
  });
  assert(c, clickedPriority, "L4 点击优先级情境卡");
  await c.waitForText("复盘报告");
  assert(c, await c.hasText("已体现"), "L4 报告-达成主张");
  assert(c, await c.hasText("待深挖"), "L4 报告-待深挖");
  assert(c, await c.hasText("下一步"), "L4 报告-下一步");

  // 进行中情境：发送消息 + Mock 回复
  await c.goto("/labs/scenario-renewal?role=learner");
  await c.waitForHydration();
  await c.waitForText("角色扮演对话");
  const labInput = 'textarea#scenario-input';
  const labMsg = "我的判断是先澄清任务：把结果带走用于跨团队沟通。";
  await c.type(labInput, labMsg);
  await c.press("Enter");
  await c.waitForText("AI 整理（演示）", 20000);
  assert(c, await c.hasText("AI 整理（演示）"), "L4 情境对话收到 Mock 回复");

  // 技能雷达
  await c.goto("/skills?role=learner");
  await c.waitForHydration();
  await c.waitForText("技能雷达");
  assert(c, await c.hasText("待开始") || await c.hasText("学习中") || await c.hasText("已有基础") || await c.hasText("证据不足"), "L4 技能维度水平徽标");
  assert(c, await c.hasText("条证据"), "L4 技能证据来源");
  assert(c, await c.hasText("优先补强"), "L4 优先补强建议");
  assert(c, await c.hasText("重写一条可验证需求假设"), "L4 comp-need 建议内容");
}

/* ================= Chain 5 ================= */
async function chain5(c) {
  await c.goto("/paths?role=learner");
  await c.waitForHydration();
  await c.waitForText("多路径");
  assert(c, await c.hasText("主路径"), "L5 路径列表-主路径");
  assert(c, await c.hasText("已暂停"), "L5 路径列表-暂停路径");

  await c.goto("/paths/path-pm?role=learner");
  await c.waitForHydration();
  await c.waitForText("计划调整建议");
  assert(c, await c.hasText("预计影响"), "L5 影响列表区");
  assert(c, await c.hasText("完成日期延后"), "L5 影响列表置顶含完成日期延后");
  // 锚点
  const anchorScroll = await c.page.evaluate(() => {
    const el = document.getElementById("adjustment");
    return !!el && el.getBoundingClientRect().top >= 0;
  });
  assert(c, anchorScroll, "L5 #adjustment 锚点定位");

  await c.clickText("接受调整");
  await c.waitForText("接受计划调整？");
  await c.clickText("确认接受");
  const adjToast = await c.waitToast("计划已更新（演示）");
  assert(c, adjToast, "L5 接受调整 toast");
  await c.sleep(300);
  assert(c, await c.hasText("已接受调整"), "L5 接受后状态");
  assert(c, await c.hasText("v2"), "L5 版本历史出现 v2");

  // 作品集
  await c.goto("/portfolio?role=learner");
  await c.waitForHydration();
  await c.waitForText("我的学习资产");
  await c.clickText("分享", { index: 0 });
  await c.waitForText("分享学习资产");
  assert(c, await c.hasText("可见范围"), "L5 分享 Modal-可见范围");
  assert(c, await c.hasText("有效期"), "L5 分享 Modal-有效期");
  await c.page.select("#share-scope", "public_link");
  await c.page.select("#share-days", "7");
  await c.clickText("确认分享");
  const shareToast = await c.waitToast("公开链接已生成（演示）");
  assert(c, shareToast, "L5 分享 toast");
  await c.sleep(300);
  assert(c, await c.hasText("公开链接"), "L5 分享后可见性徽标更新");
}

/* ================= Chain 6 ================= */
async function chain6(c) {
  await c.goto("/home?role=learner&flag=crews");
  await c.waitForHydration();
  await c.waitForText("继续学习");
  const body = await c.bodyText();
  assert(c, !body.includes("小队"), "L6 flag=crews 侧边栏无小队入口");

  await c.goto("/crews?role=learner&flag=crews");
  await c.waitForHydration();
  await c.waitForText("小队空间暂未开放");
  assert(c, await c.hasText("功能暂未开放") || await c.hasText("小队空间暂未开放"), "L6 /crews 显示功能暂未开放");
  assert(c, await c.hasText("返回首页"), "L6 /crews 返回首页 CTA");
  const not404 = !c.httpErrors.some((e) => e.status === 404 && e.url.includes("/crews"));
  assert(c, not404, "L6 /crews HTTP 200 非 404");

  // 恢复开关
  await c.clickText("在当前演示中开启");
  await c.waitForText("小队空间", 15000);
  await c.waitForText("创建小队");
  assert(c, await c.hasText("成员"), "L6 恢复后 /crews 正常");
}

/* ================= Chain 7 ================= */
async function chain7(c) {
  // learner 访问机构 → 403
  await c.goto("/org/xingqiao?role=learner");
  await c.waitForHydration();
  await c.waitForText("无权访问");
  const orgBody1 = await c.bodyText();
  assert(c, !orgBody1.includes("机构聚合指标"), "L7 learner 不渲染机构聚合数据");
  // ForbiddenState 文案本身含「机构成员」字样，改按成员卡独有文案判定未渲染成员列表
  assert(c, !orgBody1.includes("仅机构管理员可见成员列表"), "L7 learner 不渲染成员");
  assert(c, await c.hasText("当前演示角色无权访问"), "L7 learner 403 说明");

  await c.goto("/org/xingqiao/admin?role=learner");
  await c.waitForHydration();
  await c.waitForText("无权访问");
  assert(c, await c.hasText("无权访问"), "L7 learner 访问机构管理 403");

  await c.goto("/admin/content?role=learner");
  await c.waitForHydration();
  await c.waitForText("无权访问");
  assert(c, await c.hasText("该页面仅内容管理员可访问"), "L7 learner 访问内容台 403");

  // content_admin
  await c.goto("/admin/content?role=content_admin");
  await c.waitForHydration();
  await c.waitForText("内容运营台");
  assert(c, await c.hasText("资源审核") && await c.hasText("教材版本") && await c.hasText("来源域规则"), "L7 content_admin 3 个 Tab");
  assert(c, await c.hasText("权限说明"), "L7 权限提示横幅");
  assert(c, await c.hasText("不可查看普通用户私人笔记正文"), "L7 隐私说明文本");

  // org_admin
  await c.goto("/org/xingqiao?role=org_admin");
  await c.waitForHydration();
  await c.waitForText("机构聚合指标");
  assert(c, await c.hasText("机构成员"), "L7 org_admin 成员渲染");
  assert(c, await c.hasText("样本过小"), "L7 样本过小脱敏提示");

  await c.goto("/org/xingqiao/admin?role=org_admin");
  await c.waitForHydration();
  await c.waitForText("管理台");
  assert(c, await c.hasText("聚合数据") && await c.hasText("资源审核"), "L7 org_admin 管理台 tabs");
  await c.clickText("聚合数据");
  await c.sleep(300);
  assert(c, await c.hasText("—（脱敏）"), "L7 脱敏指标显示 —");

  // content_admin 访问机构管理 → 403
  await c.goto("/org/xingqiao?role=content_admin");
  await c.waitForHydration();
  await c.waitForText("无权访问");
  assert(c, await c.hasText("无权访问"), "L7 content_admin 访问机构 403");
}

/* ================= Chain 8 ================= */
const LEARNER_ROUTES = [
  "/", "/login", "/register", "/onboarding", "/home", "/path", "/path/nodes/need-signal",
  "/practice/session-active-chen", "/practice/session-active-chen/result", "/notes",
  "/review", "/labs", "/labs/scenario-priority", "/skills", "/library", "/space",
  "/paths", "/paths/path-pm", "/crews", "/crews/crew-pm", "/reviews/review-need-01",
  "/portfolio", "/search",
];
const CONTENT_ADMIN_ROUTES = ["/admin/content"];
const ORG_ADMIN_ROUTES = ["/org/xingqiao", "/org/xingqiao/admin"];

async function checkRouteHealth(c, url) {
  const out = { url, blank: false, overflow1440: false, overflow390: false, httpErrors: [], console: [], tokens: [] };
  const consoleStart = c.console.length;
  const errStart = c.httpErrors.length;
  await c.goto(url);
  await c.waitForHydration();
  await c.sleep(400);
  const bt = await c.bodyText();
  out.blank = bt.trim().length < 8;
  out.httpErrors = c.httpErrors.slice(errStart).filter((e) => e.status >= 400);
  out.console = c.console.slice(consoleStart);
  // overflow at 1440 and 390
  await c.setViewport(1440, 900);
  const o1 = await c.overflow();
  out.overflow1440 = o1.overflow;
  await c.setViewport(390, 844);
  const o2 = await c.overflow();
  out.overflow390 = o2.overflow;
  await c.setViewport(1440, 900);
  // token scan
  const tokens = await c.scanTokens();
  out.tokens = tokens;
  return out;
}

async function chain8(c) {
  const report = { routes: [] };
  // learner context
  await c.goto("/home?role=learner");
  await c.waitForHydration();
  for (const route of LEARNER_ROUTES) {
    report.routes.push(await checkRouteHealth(c, route));
  }
  // content_admin
  await c.goto("/home?role=content_admin");
  await c.waitForHydration();
  for (const route of CONTENT_ADMIN_ROUTES) {
    report.routes.push(await checkRouteHealth(c, route));
  }
  // org_admin
  await c.goto("/home?role=org_admin");
  await c.waitForHydration();
  for (const route of ORG_ADMIN_ROUTES) {
    report.routes.push(await checkRouteHealth(c, route));
  }

  const blank = report.routes.filter((r) => r.blank);
  const ov1440 = report.routes.filter((r) => r.overflow1440);
  const ov390 = report.routes.filter((r) => r.overflow390);
  const http = report.routes.filter((r) => r.httpErrors.length > 0);
  const conErr = report.routes.filter((r) => r.console.length > 0);
  const tok = report.routes.filter((r) => r.tokens.length > 0);

  assert(c, blank.length === 0, "L8 无空白页", JSON.stringify(blank.map((b) => b.url)));
  assert(c, ov1440.length === 0, "L8 1440px 无横向溢出", JSON.stringify(ov1440.map((r) => `${r.url} sw=${r.overflow1440}`)));
  assert(c, ov390.length === 0, "L8 390px 无横向溢出", JSON.stringify(ov390.map((r) => `${r.url} sw=${r.overflow390}`)));
  assert(c, http.length === 0, "L8 路由无 4xx/5xx", JSON.stringify(http.flatMap((r) => r.httpErrors)));
  assert(c, tok.length === 0, "L8 无 sk- 令牌", JSON.stringify(tok.map((r) => r.tokens)));
  console.log("L8 console-error pages:", JSON.stringify(conErr.map((r) => ({ url: r.url, n: r.console.length }))));
  report._conErr = conErr;
  c._chain8 = report;
}

/* ---------------- Dead link + token scan across key pages ---------------- */
async function globalScans(c) {
  const scan = { dead: [], tokenPages: [] };
  const pages = [
    ["/", "learner"], ["/home", "learner"], ["/path/nodes/need-signal", "learner"],
    ["/review", "learner"], ["/labs", "learner"], ["/skills", "learner"],
    ["/paths", "learner"], ["/paths/path-pm", "learner"], ["/portfolio", "learner"],
    ["/crews", "learner"], ["/admin/content", "content_admin"], ["/org/xingqiao", "org_admin"],
    ["/org/xingqiao/admin", "org_admin"], ["/practice/session-active-chen/result", "learner"],
  ];
  for (const [route, role] of pages) {
    await c.goto(`${route}?role=${role}`);
    await c.waitForHydration();
    await c.sleep(300);
    const hrefs = await c.collectHrefs();
    for (const h of hrefs) {
      const key = `${route} -> ${h}`;
      if (scan.dead.some((d) => d.key === key)) continue;
      try {
        const res = await fetch("http://localhost:3000" + h, { redirect: "manual" });
        if (res.status === 404) scan.dead.push({ key, href: h, from: route, status: 404 });
      } catch (e) {
        scan.dead.push({ key, href: h, from: route, status: "ERR" });
      }
    }
    const tokens = await c.scanTokens();
    if (tokens.length) scan.tokenPages.push({ route, tokens });
  }
  return scan;
}

/* ================= main ================= */
const CHAIN_FNS = { 1: chain1, 2: chain2, 3: chain3, 4: chain4, 5: chain5, 6: chain6, 7: chain7, 8: chain8 };
const CHAIN_NAMES = {
  1: "1. 注册→诊断→路径证据→确认→首页", 2: "2. 首页→节点→费曼→评价→下一步",
  3: "3. 周宁 离线→恢复→同步", 4: "4. 复习→情境练习→技能",
  5: "5. 多路径→计划调整→作品集分享", 6: "6. 功能开关关闭",
  7: "7. 租户/角色隔离", 8: "8. 视口与健康检查",
};

async function main() {
  const browser = await browserP;
  const chains = [];
  const only = process.argv.slice(2).map(Number).filter((n) => CHAIN_FNS[n]);

  async function runOne(n) {
    const c = await runChain(CHAIN_NAMES[n], CHAIN_FNS[n]);
    chains.push(c);
    return c;
  }

  let c1, c2, c3, c4, c5, c6, c7, c8;
  if (only.length) {
    for (const n of only) {
      const c = await runOne(n);
      if (n === 1) c1 = c;
      else if (n === 2) c2 = c;
      else if (n === 3) c3 = c;
      else if (n === 4) c4 = c;
      else if (n === 5) c5 = c;
      else if (n === 6) c6 = c;
      else if (n === 7) c7 = c;
      else if (n === 8) c8 = c;
    }
  } else {
    c1 = await runOne(1);
    c2 = await runOne(2);
    c3 = await runOne(3);
    c4 = await runOne(4);
    c5 = await runOne(5);
    c6 = await runOne(6);
    c7 = await runOne(7);
    c8 = await runOne(8);
  }

  // Global scans (dead links + tokens) in a fresh context
  let scan = { dead: [], tokenPages: [] };
  if (only.length === 0) {
    const scanC = new Chain(browser, "global-scans");
    await scanC.start();
    scan = await globalScans(scanC);
    await scanC.close();
  }

  // ---------- REPORT ----------
  const chainPass = (ch) => ch.assertions.every((a) => a.ok);
  const passCount = chains.filter(chainPass).length;
  console.log("\n\n=================== 汇总 ===================");
  console.log(`汇总：${passCount}/8 链路通过`);
  for (const ch of chains) {
    const ok = ch.assertions.filter((a) => a.ok).length;
    console.log(`- ${ch.name}: ${ok}/${ch.assertions.length}`);
    for (const a of ch.assertions.filter((x) => !x.ok)) console.log(`    FAIL: ${a.label} :: ${a.detail}`);
  }
  console.log("\n--- 死链清单 ---");
  if (scan.dead.length === 0) console.log("（无）");
  else scan.dead.forEach((d) => console.log(`${d.key} [${d.status}]`));
  console.log("\n--- sk- 令牌扫描 ---");
  if (scan.tokenPages.length === 0) console.log("（无）");
  else console.log(JSON.stringify(scan.tokenPages, null, 2));
  console.log("\n--- 控制台错误清单 ---");
  const allCons = [];
  for (const ch of chains) for (const e of ch.console) allCons.push({ chain: ch.name, ...e });
  const seen = new Set();
  const uniqCons = allCons.filter((e) => {
    const k = e.url + "|" + e.type + "|" + e.text;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (uniqCons.length === 0) console.log("（无）");
  else uniqCons.forEach((e) => console.log(`[${e.type}] ${e.url} :: ${e.text}`));
  const allPE = [];
  for (const ch of chains) for (const e of ch.pageErrors) allPE.push({ chain: ch.name, ...e });
  console.log("\n--- 页面 JS 错误 ---");
  if (allPE.length === 0) console.log("（无）");
  else allPE.forEach((e) => console.log(`[${e.chain}] ${e.url} :: ${e.text}`));
  const allReqFail = [];
  for (const ch of chains) for (const e of ch.requestFails) allReqFail.push({ chain: ch.name, ...e });
  console.log("\n--- 请求失败 ---");
  if (allReqFail.length === 0) console.log("（无）");
  else allReqFail.forEach((e) => console.log(`[${e.chain}] ${e.url} :: ${e.err}`));

  // viewport overflow from chain 8
  console.log("\n--- 视口溢出 (L8) ---");
  if (c8 && c8._chain8) {
    const rr = c8._chain8.routes;
    for (const r of rr) {
      if (r.overflow1440 || r.overflow390) {
        console.log(`${r.url} :: 1440=${r.overflow1440} 390=${r.overflow390}`);
      }
    }
    const conErrPages = c8._chain8._conErr || [];
    if (conErrPages.length) console.log("L8 console/warn pages:", JSON.stringify(conErrPages.map((r) => ({ url: r.url, n: r.console.length }))));
  }
  console.log("（L8 溢出路由见上方汇总断言）");

  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
