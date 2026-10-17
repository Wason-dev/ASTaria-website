// 「放进真实的空档」演示：一句话交给析熙四项事项，排进这一周。数据为虚构。
// 新事项的四段时间不是手写的：把这份课表、已有安排和四项事项交给应用里的自动排程
// （server/autoSchedule.mjs 的 initialTaskSchedule，当前时刻 2026-10-12 周一 07:50，任务间隔 10 分钟），
// 得到的就是下面 tasks 里的 at。规则：按截止先后，一项项放进最早能完整放下的空档；
// 紧挨已有任务时留 10 分钟；课程、吃饭和已有安排都不动。
export const START = 8 * 60, END = 22 * 60;
const m = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3);

export type Kind = 'class' | 'break' | 'task';
// t 里的 | 是窄列里允许换行的位置
export interface Item { s: string; e: string; t: string; k: Kind }
export interface Day { w: string; d: string; date: string; today?: boolean; items: Item[]; avail: [string, string][] }

const meals: Item[] = [{ s: '12:00', e: '13:00', t: '午饭', k: 'break' }, { s: '17:30', e: '18:30', t: '晚饭', k: 'break' }];
const c = (s: string, e: string, t: string): Item => ({ s, e, t, k: 'class' });
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
    items: [c('08:00', '09:40', '高等|数学'), c('10:00', '11:40', '大学|物理'), ...meals, c('19:00', '20:00', '社团|例会')],
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

// 真正空着的时间 = 可安排的时段 − 课程、吃饭和已有安排
export const free = (day: Day): [number, number][] => {
  let out = day.avail.map(([a, b]) => [m(a), m(b)] as [number, number]);
  for (const it of day.items) {
    const s = m(it.s), e = m(it.e);
    out = out.flatMap(([a, b]) => (e <= a || s >= b ? [[a, b]] : [[a, s], [e, b]].filter(([x, y]) => y > x)) as [number, number][]);
  }
  return out;
};

// 用户那句话里的四件事，按说的顺序（不是截止顺序）。phrase 是句子里对应的那一段。
export interface Task { id: string; title: string; short: string; tiny: string; phrase: string; due: string; dueDay: number; min: number; day: number; at: [string, string]; why: string }
export const tasks: Task[] = [
  { id: 'math', title: '复习高数第二章', short: '高数', tiny: '高数', phrase: '高数第二章周日前复习完，一个半小时', due: '2026-10-18', dueDay: 6, min: 90, day: 2, at: ['14:00', '15:30'],
    why: '一个半小时要一整段，周一周二都凑不出，放进周三下午的长空档' },
  { id: 'eng', title: '写英语演讲稿', short: '演讲稿', tiny: '演讲', phrase: '英语演讲稿周四交，一小时', due: '2026-10-15', dueDay: 3, min: 60, day: 1, at: ['16:00', '17:00'],
    why: '要完整一小时，今天剩下的空档都不够，排到周二 16:00' },
  { id: 'db', title: '完成数据库实验报告', short: '实验报告', tiny: '报告', phrase: '数据库实验报告周三交，45 分钟', due: '2026-10-14', dueDay: 2, min: 45, day: 0, at: ['16:00', '16:45'],
    why: '截止最早，先排。今天 16:00 的空课就放得下' },
  { id: 'word', title: '背第三单元单词', short: '单词', tiny: '单词', phrase: '第三单元单词周五默写，40 分钟', due: '2026-10-16', dueDay: 4, min: 40, day: 0, at: ['20:10', '20:50'],
    why: '今晚整理完实验数据，隔 10 分钟开始' },
];
// 截止先后（排程的顺序）
export const order = [...tasks].sort((a, b) => a.due.localeCompare(b.due)).map((t) => tasks.indexOf(t));

export const sentence = ['这周的事：', 0, '；', 1, '；', 2, '；', 3, '。帮我排进空档。'] as const;

// 回执：与应用的写法一致（创建 N 项事项：… · 已安排 N 段时间；先列事项，再列时段）
export const receipt = {
  title: `创建 ${tasks.length} 项事项：${tasks.map((t) => t.title).join('、')} · 已安排 ${tasks.length} 段时间`,
  undo: '撤销创建与安排',
  lines: [
    ...tasks.map((t) => `${t.title} · 截止 ${t.due} · 预计 ${t.min} 分钟`),
    ...order.map((i) => `${tasks[i].title} · ${days[tasks[i].day].date} ${tasks[i].at[0]}–${tasks[i].at[1]}`),
  ],
};

export const top = (t: string) => ((m(t) - START) / (END - START)) * 100;
export const span = (a: string, b: string) => ((m(b) - m(a)) / (END - START)) * 100;
export const pct = (min: number) => ((min - START) / (END - START)) * 100;
