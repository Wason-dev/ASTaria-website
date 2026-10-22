// 排程这一段：滚动推进六步（见 components/PlanWeek.astro）。
//   ① 那句话逐字打出来 ② 扫描光走过这一周，空档亮起 ③ 四件事从句子里浮起成卡片，再按截止先后排队
//   ④ 卡片一张张飞进周视图里的空档，落定后变成金色块 ⑤ 统计和回执出现 ⑥ 换个条件。往回滑就倒放。
// 排完以后每块金色都留着「为什么是这里」：点它（鼠标悬停也行），上面那行换成它的那句话。
// 换条件时金色块从原来的位置挪到新位置（FLIP），那行字先说变化最大的那一项。
// 滚动部分的画面只是滚动进度的函数：进度做一层指数平滑，滑得再快也是连贯的。
// 系统要求减少动态效果时不钉住、不推进，直接显示排好的一周；点金色块、换条件照样可用，只是不做位移动画。
const c01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (p: number, a: number, b: number) => c01((p - a) / (b - a));
const io = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // easeInOutCubic
const out = (t: number) => 1 - Math.pow(1 - t, 3);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'; // 与 base.css 的 --ease 一致

// 六步各占的滚动区间。单位沿用五步时的进度（0 = 钉住开始，1 = 原来的终点），整条轨道到 Q
const STEP: [number, number][] = [[0.02, 0.18], [0.2, 0.32], [0.34, 0.54], [0.56, 0.88], [0.89, 0.95], [1.0, 1.05]];
const Q = 1.14;
const LIFT: [number, number] = [0.34, 0.45]; // ③ 前半：浮起
const SORT: [number, number] = [0.47, 0.54]; // ③ 后半：排队
const FLY0 = 0.57, FLY_GAP = 0.075, FLY_LEN = 0.085; // ④ 第 r 张：FLY0 + r·GAP 起飞，飞 LEN
const KEEP = 0.885; // 四块都落定之后，金色块才能点
const TRY = 0.985; // 第六步：换条件的选项出现

type Box = { x: number; y: number; w: number; h: number };

export function mountPlanWeek() {
  const stage = document.querySelector<HTMLElement>('[data-pw]');
  if (!stage) return;
  const track = stage.parentElement!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const week = stage.querySelector<HTMLElement>('.pw-week')!;
  const cols = stage.querySelector<HTMLElement>('.pw-cols')!;
  const condEls = [...stage.querySelectorAll<HTMLElement>('[data-cond]')];
  const news = [...stage.querySelectorAll<HTMLElement>('.pw-new')];
  const chips = [...stage.querySelectorAll<HTMLButtonElement>('[data-pick]')];
  const reasons = new Map([...stage.querySelectorAll<HTMLElement>('[data-rs]')].map((e) => [e.dataset.rs!, e]));
  const live = stage.querySelector<HTMLElement>('[data-live]')!;
  const segEls = [...stage.querySelectorAll<HTMLElement>('[data-segs]')];
  const inCond = (el: HTMLElement, c: number) => el.dataset.cond!.split(' ').includes(String(c));
  const segsOf = (c: number) => news.filter((b) => inCond(b, c)).length;

  // ---------- 留住「为什么」：上面那行说哪一块，哪一块就描金边 ----------
  let cond = 0, picked = -1, hover = -1, keep = still, step = -1, said = '';
  const say = (key: string) => {
    if (key === said) return;
    reasons.get(said)?.classList.remove('on');
    said = key;
    reasons.get(key)?.classList.add('on');
  };
  const paint = () => {
    const t = keep ? (hover >= 0 ? hover : picked) : -1;
    news.forEach((b) => b.classList.toggle('sel', t >= 0 && +b.dataset.task! === t && inCond(b, cond)));
    if (keep) say(t >= 0 ? `${cond}-${t}` : 'hint');
    else say('');
  };
  const glow = (b: HTMLElement) => { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); };

  // ---------- 换条件：属于新条件的亮起来；金色块从原来的位置挪过去 ----------
  let swapT = 0;
  const setCond = (c: number, animate = !still, speak = true) => {
    if (c === cond) return;
    const olds = news.filter((b) => inCond(b, cond));
    const from = new Map(olds.map((b) => [b, b.getBoundingClientRect()]));
    if (animate) {
      stage.classList.add('swap');
      clearTimeout(swapT);
      swapT = window.setTimeout(() => stage.classList.remove('swap'), 500);
    }
    cond = c;
    condEls.forEach((el) => el.classList.toggle('off', !inCond(el, c)));
    if (animate) flip(olds, from);
    chips.forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.pick! === c)));
    segEls.forEach((e) => { e.textContent = String(segsOf(c)); });
    week.setAttribute('aria-label', chips[c].dataset.label!);
    picked = +chips[c].dataset.key!;
    hover = -1;
    paint();
    live.textContent = !speak ? '' : picked >= 0 ? reasons.get(`${c}-${picked}`)!.textContent! : '回到原来这周';
  };
  // 同一项：新的一块从旧的一块那里飞过去；拆成两段时两块都从原来那块飞出，合成一段时多出来的那块飞过去淡掉
  const flip = (olds: HTMLElement[], from: Map<HTMLElement, DOMRect>) => {
    const fresh = news.filter((b) => inCond(b, cond) && !olds.includes(b));
    const used = new Set<HTMLElement>();
    const move = (el: HTMLElement, a: DOMRect, b: DOMRect) => {
      el.getAnimations().forEach((x) => x.cancel());
      return el.animate([
        { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)`, height: `${a.height}px`, zIndex: 2 },
        { transform: 'none', height: `${b.height}px`, zIndex: 2 },
      ], { duration: 620, easing: EASE });
    };
    for (const b of fresh) {
      const task = b.dataset.task;
      const src = olds.find((o) => o.dataset.task === task && !used.has(o)) ?? olds.find((o) => o.dataset.task === task);
      if (!src) { b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: EASE }); glow(b); continue; }
      used.add(src);
      move(b, from.get(src)!, b.getBoundingClientRect()).finished.then(() => glow(b), () => {});
    }
    for (const o of olds) {
      if (used.has(o) || inCond(o, cond)) continue;
      const dest = fresh.find((b) => b.dataset.task === o.dataset.task);
      if (!dest) continue;
      // 终点是合并后的那一块：从原来的位置飞到它那里，边飞边淡掉
      const d = dest.getBoundingClientRect(), r = o.getBoundingClientRect(), a = from.get(o)!;
      o.getAnimations().forEach((x) => x.cancel());
      o.animate([
        { transform: `translate(${a.left - r.left}px, ${a.top - r.top}px)`, height: `${a.height}px`, visibility: 'visible', opacity: 1 },
        { transform: `translate(${d.left - r.left}px, ${d.top - r.top}px)`, height: `${d.height}px`, visibility: 'visible', opacity: 0 },
      ], { duration: 620, easing: EASE });
    }
  };
  // 金色块很小（窄屏上一块只有十几像素高），点在它周围 10px 内都算点中，取最近的一块
  const near = (x: number, y: number) => {
    let best = -1, bd = 10;
    for (const b of news) {
      if (!inCond(b, cond)) continue;
      const r = b.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (d <= bd) { bd = d; best = +b.dataset.task!; }
    }
    return best;
  };
  cols.addEventListener('click', (e) => {
    if (!keep) return;
    picked = near(e.clientX, e.clientY);
    hover = -1;
    paint();
    if (picked >= 0) live.textContent = reasons.get(`${cond}-${picked}`)!.textContent!;
  });
  cols.addEventListener('pointermove', (e) => {
    if (!keep || e.pointerType !== 'mouse') return;
    const h = near(e.clientX, e.clientY);
    cols.style.cursor = h >= 0 ? 'pointer' : '';
    if (h !== hover) { hover = h; paint(); }
  });
  cols.addEventListener('pointerleave', () => { cols.style.cursor = ''; if (hover >= 0) { hover = -1; paint(); } });
  chips.forEach((b) => b.addEventListener('click', () => setCond(+b.dataset.pick!)));
  track.classList.add('tap');

  if (still) { paint(); return; }

  // ---------- 滚动推进 ----------
  const narrow = matchMedia('(max-width: 1023px)'); // 与 plan.css 的窄屏断点一致
  const chars = [...stage.querySelectorAll<HTMLElement>('.pw-text [aria-hidden] i')];
  const phrases = [...stage.querySelectorAll<HTMLElement>('[data-ph]')];
  const slots = [...stage.querySelectorAll<HTMLElement>('.pw-slot')];
  const cards = [...stage.querySelectorAll<HTMLElement>('[data-card]')];
  const blocks = [...stage.querySelectorAll<HTMLElement>('[data-new]')];
  const dues = [...stage.querySelectorAll<HTMLElement>('[data-due]')];
  const whys = [...stage.querySelectorAll<HTMLElement>('[data-why]')];
  const bars = [...stage.querySelectorAll<HTMLElement>('.pw-bar i')];
  const N = cards.length;
  const rank = cards.map((c) => +c.dataset.rank!);
  const phraseOf = (i: number) => phrases.find((p) => +p.dataset.ph! === i)!;
  const blockOf = (i: number) => blocks.find((b) => +b.dataset.new! === i)!;
  const caret = document.createElement('span');
  caret.className = 'pw-caret';

  track.classList.add('live');

  // 量一次各处的位置（相对舞台）。舞台钉住后内部不再移动，滚动时不用重量。
  let from: Box[] = [], slot: Box[] = [], to: Box[] = [], stickTop = 52;
  const rel = (r: DOMRect, o: DOMRect): Box => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
  const measure = () => {
    // 换条件的位移动画还在走时先让它走完，量到的才是金色块真正的位置（落点的亮光是 CSS 动画，不用管）
    news.forEach((b) => b.getAnimations().forEach((x) => { if (!('animationName' in x)) x.finish(); }));
    const o = stage.getBoundingClientRect();
    from = cards.map((_, i) => { const f = phraseOf(i).getClientRects()[0]; return rel(f ?? phraseOf(i).getBoundingClientRect(), o); });
    slot = slots.map((s) => rel(s.getBoundingClientRect(), o));
    to = cards.map((_, i) => rel(blockOf(i).getBoundingClientRect(), o));
    cards.forEach((c, i) => {
      c.style.setProperty('--w0', `${slot[0].w}px`);
      c.style.setProperty('--w1', `${to[i].w}px`);
    });
    stickTop = parseFloat(getComputedStyle(stage).top) || 0;
    // 宽屏第六步选项代替那句话，比它矮：统计和回执往上收这么多，中间不留一块空
    const sayEl = stage.querySelector<HTMLElement>('.pw-say')!, tryEl = stage.querySelector<HTMLElement>('.pw-try')!;
    stage.style.setProperty('--pull', `${narrow.matches ? 0 : Math.max(0, sayEl.offsetHeight - tryEl.offsetHeight)}px`);
    painted = -1;
  };
  let painted = -1, typed = -1;
  const landed = new Array(N).fill(false);
  const render = (raw: number) => {
    if (raw === painted) return;
    painted = raw;
    const p = raw * Q;
    const set = (key: string, v: number) => stage.style.setProperty(key, String(Math.round(v * 1000) / 1000));

    // ① 逐字打出来：光标跟在最后一个字后面
    const ty = io(seg(p, ...STEP[0])) * chars.length;
    set('--ty', ty);
    const n = Math.ceil(ty - 0.001);
    if (n !== typed) {
      typed = n;
      if (n >= chars.length) caret.remove();
      else if (n <= 0) chars[0].before(caret);
      else chars[n - 1].after(caret);
    }

    // ② 扫描光走过这一周
    const sc = seg(p, ...STEP[1]);
    set('--sc', sc);
    set('--sb', Math.sin(Math.PI * sc));

    // ③ 句子变暗（窄屏上整句淡出，让位给卡片），四件事亮成金色
    const lift = seg(p, ...LIFT), sort = io(seg(p, ...SORT));
    set('--sd', c01(lift * 1.6));
    set('--sv', narrow.matches ? 1 - c01((lift - 0.15) * 2.2) : 1 - seg(p, 0.86, 0.9) * 0.55);

    // ⑤ 回执 ⑥ 换条件的选项（宽屏上代替那句话，窄屏上代替统计和回执）
    set('--dn', out(seg(p, ...STEP[4])));
    set('--tv', out(seg(p, TRY, STEP[5][1])));
    bars.forEach((b, i) => b.style.setProperty('--f', String(Math.round(seg(p, ...STEP[i]) * 1000) / 1000)));
    let s = 0;
    STEP.forEach(([a], i) => { if (p >= (i === 5 ? TRY : a - 0.015)) s = i; });
    if (s !== step) {
      // 从第六步往回滑：回到原来这周
      if (step === 5 && s < 5) setCond(0, true, false);
      step = s;
      stage.dataset.step = String(s);
    }
    const k = p >= KEEP;
    if (k !== keep) {
      keep = k;
      if (!k) { picked = -1; hover = -1; cols.style.cursor = ''; }
      paint();
    }

    for (let i = 0; i < N; i++) {
      const r = rank[i], card = cards[i];
      const li = out(seg(lift, i * 0.17, i * 0.17 + 0.5)); // 按说的顺序依次浮起
      const f0 = FLY0 + r * FLY_GAP, fl = seg(p, f0, f0 + FLY_LEN), fe = io(fl);
      phraseOf(i).style.setProperty('--h', String(Math.round(c01(li * 1.4) * (1 - fl * 0.6) * 1000) / 1000));
      dues.forEach((d) => { if (+d.dataset.due! === i) d.style.setProperty('--o', String(Math.round(li * 1000) / 1000)); });

      // 说明：这一张起飞前一点出现，下一张起飞时换掉；最后一张留到四块都落定（之后由留下来的那行接手）
      const until = r === N - 1 ? KEEP : f0 + FLY_GAP - 0.005;
      const wo = c01(Math.min((p - (f0 - 0.03)) / 0.02, (until - p) / 0.02));
      whys[i].style.setProperty('--o', String(Math.round(wo * 1000) / 1000));
      // 落定：卡片藏起来，换成周视图里的金色块，亮一下
      const done = fl >= 1;
      blockOf(i).style.setProperty('--l', done ? '1' : '0');
      if (done !== landed[i]) { landed[i] = done; blockOf(i).classList.toggle('hit', done); }
      if (li <= 0 || done) { card.style.visibility = 'hidden'; continue; }
      card.style.visibility = 'visible';

      let b: Box, m = 0, sc2 = 1;
      const a = slot[i], q = slot[r];
      if (sort <= 0) {
        // 浮起：从句子里那一段升起，变成卡片
        const st = from[i];
        b = { x: mix(st.x, a.x, li), y: mix(st.y, a.y, li) - Math.sin(Math.PI * li) * 10, w: mix(st.w, a.w, li), h: mix(st.h, a.h, li) };
        card.style.opacity = String(c01(li * 2.5));
      } else if (fl <= 0) {
        // 排队：往下挪的从右边绕、往上挪的从左边绕，不会叠在一起
        const dir = Math.sign(r - i);
        b = { x: a.x + dir * Math.sin(Math.PI * sort) * 24, y: mix(a.y, q.y, sort), w: a.w, h: a.h };
        sc2 = 1 - dir * Math.sin(Math.PI * sort) * 0.03; // 往上挪的稍微靠前、往下挪的稍微退后
        card.style.opacity = '1';
        card.style.zIndex = dir < 0 ? '2' : '1';
      } else {
        // 飞进空档：走一道弧线，边飞边缩成周视图里的一小块
        const t = to[i];
        b = { x: mix(q.x, t.x, fe), y: mix(q.y, t.y, fe) - Math.sin(Math.PI * fe) * 46, w: mix(q.w, t.w, fe), h: mix(q.h, t.h, fe) };
        m = c01((fe - 0.35) / 0.5);
        sc2 = 1 + Math.sin(Math.PI * fe) * 0.04;
        card.style.opacity = '1';
        card.style.zIndex = '3';
      }
      card.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0) scale(${sc2.toFixed(3)})`;
      card.style.width = `${b.w.toFixed(1)}px`;
      card.style.height = `${b.h.toFixed(1)}px`;
      card.style.setProperty('--m', m.toFixed(3));
    }
  };

  // 滚动进度：舞台钉住的那一段 0→1；显示值指数平滑地追上去
  const target = () => {
    const run = track.offsetHeight - stage.offsetHeight;
    return run > 0 ? c01((stickTop - track.getBoundingClientRect().top) / run) : 0;
  };
  let shown = target(), raf = 0, last = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const want = target();
    shown += (want - shown) * (1 - Math.exp(-dt * 10));
    if (Math.abs(want - shown) < 0.0004) shown = want;
    render(Math.round(shown * 10000) / 10000);
    raf = shown === want ? 0 : requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  measure();
  render(shown);
  paint();
  addEventListener('scroll', kick, { passive: true });
  let rz = 0;
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { measure(); render(shown); kick(); }); });
  document.fonts?.ready.then(() => { measure(); render(shown); });
}
