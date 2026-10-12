// 更新记录（用户语言）。来源：ASTaria 仓库公开的 CHANGELOG.md 与各版发布说明。
// 只收录已发布的版本；CHANGELOG 中「未发布」一节不进入官网。新版本加在数组最前面。
// 分组：added 新增 · fixed 修复 · perf 性能与省电 · compat 兼容性 · limits 已知限制 · unverified 未验收

export interface Entry {
  version: string;
  name: string;
  date: string;
  tag: string;
  added?: string[];
  fixed?: string[];
  perf?: string[];
  compat?: string[];
  limits?: string[];
  unverified?: string[];
}

export const GROUPS = [
  ['added', '新增'], ['fixed', '修复'], ['perf', '性能与省电'], ['compat', '兼容性'], ['limits', '已知限制'], ['unverified', '未验收'],
] as const;

export const changelog: Entry[] = [
  {
    version: '0.1.0-beta.12.1', name: 'Beta12.1', date: '2026-10-11', tag: 'v0.1.0-beta.12.1',
    fixed: [
      '首页与工作台专注聊天恢复简洁输入框：去掉输入框上方的「图片」栏，圆形 ＋ 放在「发给析熙」左边。',
      '图片可以直接拖进 ASTaria。专注聊天打开时优先接收，其他页面打开首页聊天；拖入后仍需你确认发送。',
      '选图和拖图使用同一套校验。读取中不能发送，快速换图只保留最后一次选择，失败后不会误带上一张图片。',
      '从展开的首页聊天切到工作区时，相机运动期间保持所选帧率，停稳后才进入工作区的省电上限。',
    ],
    compat: ['macOS 与 Windows 使用同一补丁版本，应用内更新按平台选择配套的安装包和签名清单。'],
    limits: ['每条消息一张图片，PNG、JPEG 或 WebP，不超过 2 MB。需要支持视觉输入的模型。', 'Windows 为未签名试验版，切页与展开聊天仍有卡顿反馈。'],
    unverified: ['真实模型识图。', 'Windows 本版成品的实机安装与交互、Windows 11、真实自动升级与失败回退。'],
  },
  {
    version: '0.1.0-beta.12', name: 'Beta12', date: '2026-10-11', tag: 'v0.1.0-beta.12',
    added: [
      '聊天可以附一张图片，保存在本机，随这一次请求发给所选模型；支持备份、撤回与重试。图片不进入目录同步。',
      '打开联网搜索后，你给出的完整网址由本机直接读取网页正文，不必先被搜索引擎收录。',
    ],
    fixed: [
      '部分操作没有完成时，保留析熙的正常回复，未完成的原因单独列出，不再用固定清单替换聊天正文。',
      '排程回执标题简化为「安排 N 段任务时间」，日期与起止时刻只在明细里出现一次。',
      '事项改期后，旧的系统提醒会被取消并按新时间重建（macOS）。',
      '弦轨只重排你实际调整过的日期；今天已满不再挡住只修改明天的方案。',
    ],
    perf: ['工作台、余时、日程、设置的背景渲染上限改为 30 FPS 以省电；首页与聊天不受影响，画质不变。'],
    limits: ['Windows 只有 App 内提醒，退出 App 后不会提醒。', '搜索取不到可核实正文时的兜底处理仍待改进。'],
    unverified: ['真实模型识图、实际 Syncthing 传输、Windows 当前包的实机验收。'],
  },
  {
    version: '0.1.0-beta.11', name: 'Beta11', date: '2026-10-08', tag: 'v0.1.0-beta.11',
    added: ['Windows 标准安装版加入应用内更新：校验签名清单、SHA-256 与大小，退出后静默安装并重启，启动失败时尝试回退。'],
    fixed: ['聊天进入可输入状态后不再额外等待相机停稳（macOS 上消除约 1.1 秒的多余等待）。'],
    perf: ['减少不必要的模糊通道、重复的相机采样与渲染调度重建；分辨率、采样、辉光与画质不变。'],
    limits: ['Windows 便携版和非标准安装位置需要手动更新。', 'Windows 切页与展开聊天仍有卡顿。'],
    unverified: ['Windows 真实自动升级与回退、Windows 11。'],
  },
  {
    version: '0.1.0-beta.10', name: 'BetaX', date: '2026-10-05', tag: 'v0.1.0-beta.10',
    added: [
      '跨设备同步：选择共享文件夹或已有的 Syncthing 目录，只传 AES-256-GCM 加密的操作文件，冲突需要你确认。',
      'Windows x64 试验版（安装程序与便携包），API Key 由 DPAPI 保护。',
      '首次设置加入帧率与画质选择。',
    ],
    fixed: ['修正假期标签、首次设置假期时段，以及析熙的阶段与工具摘要。'],
    compat: ['Windows 玻璃默认使用 CSS 通透/磨砂，可在设置中切换为精细折射。'],
    limits: ['Windows 版没有应用内更新，第一次升级到 Beta11 必须手动安装。'],
    unverified: ['Windows 11、原地升级、睡眠恢复、更多 DPI 与多屏组合、实际 Syncthing 跨机传送。'],
  },
  {
    version: '0.1.0-beta.9', name: 'Beta9', date: '2026-10-03', tag: 'v0.1.0-beta.9',
    added: ['日历例外：假期、临时停课、临时换用其他星期的课表、恢复原安排，一次最多覆盖 31 天。'],
    fixed: ['联网搜索只用成功取得正文的来源核对事实，取不到正文时明确说明。'],
  },
  {
    version: '0.1.0-beta.8', name: 'Beta8', date: '2026-10-02', tag: 'v0.1.0-beta.8',
    added: ['首次启动引导：外观与析熙个性、可跳过的 API Key，以及各主要页面的真实介绍。'],
    fixed: ['弦轨超过一屏的分组可以用中轴箭头翻页；整理与保存显示真实执行进度。'],
  },
  {
    version: '0.1.0-beta.7', name: 'Beta7', date: '2026-10-01', tag: 'v0.1.0-beta.7',
    added: ['按需联网搜索，默认关闭。'],
    fixed: ['安装在「应用程序」里时不再被误报为需要移动到可写目录。'],
  },
  {
    version: '0.1.0-beta.6', name: 'Beta6', date: '2026-09-30', tag: 'v0.1.0-beta.6',
    added: ['余时长期计划：按周大纲安排，完成当前阶段后再安排后续阶段。'],
  },
  {
    version: '0.1.0-beta.5', name: 'Beta5', date: '2026-09-29', tag: 'v0.1.0-beta.5',
    added: ['应用内更新加入 Ed25519 发布清单签名校验。'],
    fixed: ['区分当前估时与已排时长；自动初排优先整段，避免不足 15 分钟的碎片。'],
  },
  {
    version: '0.1.0-beta.4', name: 'Beta4', date: '2026-09-29', tag: 'v0.1.0-beta.4',
    added: ['课表支持单双周。', 'macOS 退出 App 后仍可收到系统预约提醒。'],
  },
  {
    version: '0.1.0-beta.3', name: 'Beta3', date: '2026-09-29', tag: 'v0.1.0-beta.3',
    added: ['设置内检查更新、下载校验、安装并重启，失败时尝试回退。'],
  },
  {
    version: '0.1.0-beta.2', name: 'Beta2', date: '2026-09-27', tag: 'v0.1.0-beta.2',
    fixed: ['余时长期目标跨周持续自动安排；安排结果显示实际新增数量。'],
  },
  {
    version: '0.1.0-beta.1', name: 'Beta1', date: '2026-09-26', tag: 'v0.1.0-beta.1',
    added: ['首个 macOS Apple Silicon 桌面预发布包。', '弦轨接入真实三日日程与智能分组。'],
  },
];
