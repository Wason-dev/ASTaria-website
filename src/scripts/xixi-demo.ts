// 和析熙聊的演示：输入框里逐字打出你的话 → 发出 → 析熙「正在想」→ 回复 → 回执或步骤清单。
// 播完一段停几秒自动换下一段；点场景立即播那一段，之后不再自动换。
// 滚出屏幕时暂停在当前一步；减少动态效果时直接显示完整对话。
import type { Scene } from '../data/xixi';

export function mountXixiDemo() {
  const root = document.querySelector<HTMLElement>('[data-xixi]');
  if (!root) return;
  const scenes: Scene[] = JSON.parse(root.querySelector('[data-scenes]')!.textContent!);
  const log = root.querySelector<HTMLElement>('.xx-log')!;
  const field = root.querySelector<HTMLElement>('.xx-field')!;
  const placeholder = field.textContent!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-scene]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let run = 0;            // 每次换场景 +1，旧的播放流程看到编号变了就自行停止
  let auto = !reduce;
  let visible = false;
  let cur = 0;

  const el = (tag: string, cls: string, text?: string) => {
    const e = document.createElement(tag);
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const msg = (who: 'me' | 'ai', text: string) => {
    const m = el('div', `msg ${who} pop`);
    m.append(el('span', 'who', who === 'me' ? '你' : '析熙'), el('p', '', text));
    return m;
  };
  const extra = (s: Scene) => {
    if (s.receipt) {
      const r = el('div', 'rcpt pop');
      const t = el('p', 'rcpt-t', s.receipt.title);
      t.append(el('span', 'rcpt-u', s.receipt.undo));
      r.append(t, ...s.receipt.lines.map((l) => el('p', 'rcpt-l', l)));
      return r;
    }
    if (s.steps) {
      const r = el('div', 'rcpt steps pop');
      r.append(el('p', 'rcpt-t', `拆成 ${s.steps.length} 个步骤`));
      s.steps.forEach((t) => r.append(el('p', 'step', t)));
      return r;
    }
    return null;
  };
  const full = (s: Scene) => {
    log.replaceChildren(msg('me', s.user), msg('ai', s.reply));
    const x = extra(s);
    if (x) log.append(x);
    field.textContent = placeholder;
    field.classList.remove('typing');
  };

  // 可暂停的等待：滚出屏幕时不前进
  const wait = (ms: number, id: number) => new Promise<boolean>((done) => {
    let left = ms, last = performance.now();
    const tick = (now: number) => {
      if (id !== run) return done(false);
      if (visible) left -= now - last;
      last = now;
      if (left <= 0) return done(true);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const play = async (i: number) => {
    const id = ++run;
    cur = i;
    chips.forEach((c, k) => c.setAttribute('aria-pressed', String(k === i)));
    const s = scenes[i];
    if (reduce) return full(s);
    log.replaceChildren();
    field.textContent = '';
    field.classList.add('typing');
    // 逐字打出
    for (const ch of s.user) {
      if (!(await wait(34, id))) return;
      field.textContent += ch;
    }
    if (!(await wait(420, id))) return;
    field.textContent = placeholder;
    field.classList.remove('typing');
    log.append(msg('me', s.user));
    if (!(await wait(500, id))) return;
    const dots = el('div', 'msg ai thinking pop');
    dots.append(el('span', 'who', '析熙'), el('span', 'dots', ''));
    log.append(dots);
    if (!(await wait(1300, id))) return;
    dots.replaceWith(msg('ai', s.reply));
    const x = extra(s);
    if (x) {
      if (!(await wait(600, id))) return;
      log.append(x);
    }
    if (!(await wait(5200, id))) return;
    if (auto) play((cur + 1) % scenes.length);
  };

  chips.forEach((c, i) => c.addEventListener('click', () => { auto = false; play(i); }));
  let started = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !started) { started = true; play(0); }
  }, { threshold: 0.4 }).observe(root);
  if (reduce) full(scenes[0]);

  // 窄屏的窗口高度：把每段对话放进一个看不见的副本里量一遍，取最高那段，刚好放下、不留大空白。
  // 只在窄屏（CSS 里用 --xx-h）生效；宽屏仍是固定高度
  const win = root.querySelector<HTMLElement>('.xx-win')!;
  const fit = () => {
    if (!matchMedia('(max-width: 899px)').matches) { win.style.removeProperty('--xx-h'); return; }
    const probe = log.cloneNode(false) as HTMLElement;
    probe.style.cssText = 'position:absolute;visibility:hidden;left:0;top:0;height:auto;flex:none;justify-content:flex-start';
    probe.style.width = `${log.clientWidth}px`;
    win.append(probe);
    let tallest = 0;
    for (const sc of scenes) {
      probe.replaceChildren(msg('me', sc.user), msg('ai', sc.reply));
      const x = extra(sc);
      if (x) probe.append(x);
      probe.querySelectorAll('.pop').forEach((e) => e.classList.remove('pop'));
      tallest = Math.max(tallest, probe.offsetHeight);
    }
    probe.remove();
    win.style.setProperty('--xx-h', `${win.offsetHeight - log.offsetHeight + tallest + 4}px`);
  };
  fit();
  addEventListener('resize', fit);
  document.fonts?.ready.then(fit);
}
