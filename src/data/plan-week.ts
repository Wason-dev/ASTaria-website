// 「放进真实的空档」演示：一句话交给析熙四项事项，排进这一周。数据为虚构。
// 落点不是手写的：把这份课表、已有安排和四项事项交给应用里的自动排程
// （server/autoSchedule.mjs 的 initialTaskSchedule，当前时刻 2026-10-12 周一 07:50，任务间隔 10 分钟），
// 得到的就是下面 conds 里的 places。规则：按截止先后，一项项放进最早能完整放下的空档；
// 一整段都放不下才拆开，每段至少 15 分钟；紧挨已有任务时留 10 分钟；课程、吃饭和已有安排都不动。
// 「换个条件」的两种情况各只改一个输入，再交给同一个函数重算：
//   · 周三早上加一场高数小测：「复习高数第二章」的截止改为 2026-10-13（小测前一天）
//   · 每晚只空一小时：可安排的时段只剩每天 21:00–22:00
// 每一段旁边留一句「为什么是这里」（why），排的时候知道，排完也留着。
export const START = 8 * 60, END = 22 * 60;
const m = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3);

export type Kind = 'class' | 'break' | 'task';
// t 里的 | 是窄列里允许换行的位置；alt 是「加一场小测」时这一格换上的名字
export interface Item { s: string; e: string; t: string; k: Kind; alt?: string }
export interface Day { w: string; d: string; date: string; today?: boolean; items: Item[]; avail: [string, string][] }

const meals: Item[] = [{ s: '12:00', e: '13:00', t: '午饭', k: 'break' }, { s: '17:30', e: '18:30', t: '晚饭', k: 'break' }];
const c = (s: string, e: string, t: string, alt?: string): Item => ({ s, e, t, k: 'class', alt });
const night: [string, string] = ['19:00', '21:00'];

export const days: Day[] = [
  { w: '周一', d: '10/12', date: '2026-10-12', today: true,
    items: [c('08:00', '09:40', '高等|数学'), c('10:00', '11:40', '大学|英语'), c('14:00', '15:40', '数据库|实验'), ...meals,
      { s: '19:00', e: '20:00', t: '实验数据|整理', k: 'task' }],
    avail: [['16:00', '17:30'], night] },
  { w: '周二', d: '10/13', date: '2026-10-13',
    items: [c('08:00', '09:40', '数据|结构'), c('10:00', '11:40', '计算机|网络'), c('14:00', '15:40', '体育'), ...meals,
      { s: '19:00', e: '20:00', t: '数据结构|作业', k: 'task' }],
    avail: [['16:00', '17:30'], night] },
  { w: '周三', d: '10/14', date: '2026-10-14',
    // 社团例会是「和析熙聊」里记下的那个单日活动
    items: [c('08:00', '09:40', '高等|数学', '高数|小测'), c('10:00', '11:40', '大学|物理'), ...meals, c('19:00', '20:00', '社团|例会')],
    avail: [['14:00', '17:30'], night] },
  { w: '周四', d: '10/15', date: '2026-10-15',
    items: [c('08:00', '09:40', '数据|结构'), c('10:00', '11:40', '大学|英语'), c('14:00', '15:40', '计算机|网络'), ...meals],
    avail: [['16:00', '17:30'], night] },
  { w: '周五', d: '10/16', date: '2026-10-16',
    items: [c('08:00', '09:40', '大学|物理'), c('10:00', '11:40', '数据库|原理'), ...meals],
    avail: [['14:00', '17:30'], night] },
  { w: '周六', d: '10/17', date: '2026-10-17', items: [...meals], avail: [['09:00', '11:30'], ['14:30', '17:00']] },
  { w: '周日', d: '10/18', date: '2026-10-18', items: [...meals], avail: [['09:00', '11:30'], ['14:30', '17:00']] },
];

// 真正空着的时间 = 可安排的时段 − 课程、吃饭和已有安排（avail 不传时用这一天自己的）
export const free = (day: Day, avail: [string, string][] = day.avail): [number, number][] => {
  let out = avail.map(([a, b]) => [m(a), m(b)] as [number, number]);
  for (const it of day.items) {
    const s = m(it.s), e = m(it.e);
    out = out.flatMap(([a, b]) => (e <= a || s >= b ? [[a, b]] : [[a, s], [e, b]].filter(([x, y]) => y > x)) as [number, number][]);
  }
  return out;
};
const dayOf = (date: string) => days.findIndex((d) => d.date === date);

// 用户那句话里的四件事，按说的顺序（不是截止顺序）。phrase 是句子里对应的那一段。
export interface Task { id: string; title: string; short: string; tiny: string; phrase: string; due: string; min: number }
export const tasks: Task[] = [
  { id: 'math', title: '复习高数第二章', short: '高数', tiny: '高数', phrase: '高数第二章周日前复习完，一个半小时', due: '2026-10-18', min: 90 },
  { id: 'eng', title: '写英语演讲稿', short: '演讲稿', tiny: '演讲', phrase: '英语演讲稿周四交，一小时', due: '2026-10-15', min: 60 },
  { id: 'db', title: '完成数据库实验报告', short: '实验报告', tiny: '报告', phrase: '数据库实验报告周三交，45 分钟', due: '2026-10-14', min: 45 },
  { id: 'word', title: '背第三单元单词', short: '单词', tiny: '单词', phrase: '第三单元单词周五默写，40 分钟', due: '2026-10-16', min: 40 },
];
// 截止先后（排程的顺序）
export const order = [...tasks].sort((a, b) => a.due.localeCompare(b.due)).map((t) => tasks.indexOf(t));

// 一段时间：第 task 项排在第 day 天 at；why 是排的时候为什么选这里
export interface Place { task: number; day: number; at: [string, string]; why: string }
// key：换到这个条件时先说哪一项为什么变（-1 = 只提示可以点）
export interface Cond { label: string; due?: Record<number, string>; avail?: [string, string][]; alt?: boolean; key: number; places: Place[] }
const P = (task: number, date: string, s: string, e: string, why: string): Place => ({ task, day: dayOf(date), at: [s, e], why });
export const conds: Cond[] = [
  { label: '原来这周', key: -1, places: [
    P(2, '2026-10-12', '16:00', '16:45', '截止最早，先排；今天下午这段空课就放得下。'),
    P(1, '2026-10-13', '16:00', '17:00', '要完整一小时，今天剩下的空档都不够。'),
    P(3, '2026-10-12', '20:10', '20:50', '今晚整理完实验数据，隔 10 分钟开始。'),
    P(0, '2026-10-14', '14:00', '15:30', '要连续一个半小时，周一周二剩下的都凑不出，这是最早够长的一段。'),
  ] },
  { label: '周三早上加一场高数小测', due: { 0: '2026-10-13' }, alt: true, key: 0, places: [
    P(0, '2026-10-12', '16:00', '17:30', '周三早上小测，要在周二前复习完，今天下午正好一整段。'),
    P(2, '2026-10-12', '20:10', '20:55', '下午让给了高数，今晚整理完实验数据，隔 10 分钟开始。'),
    P(1, '2026-10-13', '16:00', '17:00', '要完整一小时，今天剩下的空档都不够。'),
    P(3, '2026-10-13', '20:10', '20:50', '周一晚上排满了，周二作业后隔 10 分钟开始。'),
  ] },
  { label: '每晚只空一小时', avail: [['21:00', '22:00']], key: 0, places: [
    P(2, '2026-10-12', '21:00', '21:45', '截止最早，先占今晚这一小时。'),
    P(1, '2026-10-13', '21:00', '22:00', '要完整一小时，今晚剩下的不够。'),
    P(3, '2026-10-14', '21:00', '21:40', '周一周二晚上都排满了，周三是最早还空着的一晚。'),
    P(0, '2026-10-15', '21:00', '22:00', '每晚只空一小时，一个半小时放不下，分两晚做完。'),
    P(0, '2026-10-16', '21:00', '21:30', '每晚只空一小时，一个半小时放不下，分两晚做完。'),
  ] },
];
export const dueDay = (i: number, ci = 0) => dayOf(conds[ci].due?.[i] ?? tasks[i].due);

// 留下来的那句话：「排到周三 14:00：……」。拆成两段时写「排到周四、周五 21:00」
export const reason = (ci: number, ti: number) => {
  const ps = conds[ci].places.filter((p) => p.task === ti);
  return `排到${ps.map((p) => days[p.day].w).join('、')} ${[...new Set(ps.map((p) => p.at[0]))].join('、')}：${ps[0].why}`;
};

export const sentence = ['这周的事：', 0, '；', 1, '；', 2, '；', 3, '。帮我排进空档。'] as const;

// 回执：与应用的写法一致（创建 N 项事项：… · 已安排 N 段时间；先列事项，再列时段）
export const receiptHead = `创建 ${tasks.length} 项事项：${tasks.map((t) => t.title).join('、')} · 已安排 `;
export const receiptUndo = '撤销创建与安排';
export const receiptLines = (ci: number) => [
  ...tasks.map((t, i) => `${t.title} · 截止 ${conds[ci].due?.[i] ?? t.due} · 预计 ${t.min} 分钟`),
  ...conds[ci].places.map((p) => `${tasks[p.task].title} · ${days[p.day].date} ${p.at[0]}–${p.at[1]}`),
];
export const weekLabel = (ci: number) =>
  `示意图：这一周的课程、吃饭和已有安排不动；${conds[ci].places.map((p) => `${tasks[p.task].title}排在${days[p.day].w} ${p.at[0]}–${p.at[1]}`).join('，')}，全部在截止前`;

export const top = (t: string) => ((m(t) - START) / (END - START)) * 100;
export const span = (a: string, b: string) => ((m(b) - m(a)) / (END - START)) * 100;
export const pct = (min: number) => ((min - START) / (END - START)) * 100;
