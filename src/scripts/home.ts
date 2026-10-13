// 首页交互：功能区（点击切换 + 自动轮播）和细节区横向卡片。
// 没有 JS 时：功能区说明全部展开、画面按顺序排开，卡片可以直接横向滑动。
export function mountHome() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 功能区：左列标题 + 右侧大画面 ----------
  // 点标题：展开它的说明、换右侧画面。不点时自动轮播，当前标题下的细线就是进度。
  const root = document.querySelector<HTMLElement>('[data-tabs]');
  if (root) {
    root.classList.add('live');
    const items = [...root.querySelectorAll<HTMLElement>('.fi')];
    const btns = items.map((it) => it.querySelector<HTMLButtonElement>('.fi-btn')!);
    const panels = [...root.querySelectorAll<HTMLElement>('.panel')];
    let cur = 0;
    let auto = !reduce;
    const select = (i: number) => {
      cur = (i + items.length) % items.length;
      items.forEach((it, k) => {
        const on = k === cur;
        it.classList.toggle('on', on);
        btns[k].setAttribute('aria-expanded', String(on));
        panels[k].classList.toggle('on', on);
        // 画出来的图：切到它时重新播一次
        panels[k].querySelectorAll('[data-play]').forEach((d) => { d.classList.remove('play'); if (on) { void (d as HTMLElement).offsetWidth; d.classList.add('play'); } });
        const bar = it.querySelector('.fi-bar i')!;
        bar.classList.remove('run');
        if (on && auto) { void (bar as HTMLElement).offsetWidth; bar.classList.add('run'); }
      });
    };
    btns.forEach((b, i) => b.addEventListener('click', () => { auto = false; root.classList.add('manual'); select(i); }));
    items.forEach((it) => it.querySelector('.fi-bar i')!.addEventListener('animationend', () => auto && select(cur + 1)));
    const pause = (on: boolean) => root.classList.toggle('paused', on);
    root.addEventListener('pointerenter', () => pause(true));
    root.addEventListener('pointerleave', () => pause(false));
    root.addEventListener('focusin', () => pause(true));
    root.addEventListener('focusout', () => pause(false));
    new IntersectionObserver(([e]) => root.classList.toggle('offscreen', !e.isIntersecting), { threshold: 0.35 }).observe(root);
    select(0);
  }

  // ---------- 画出来的图：进入视口时播放（play 只加一次），循环动画只在可见时运行（vis） ----------
  const plays = [...document.querySelectorAll<HTMLElement>('[data-play]')].filter((d) => !d.closest('.panel'));
  const pio = new IntersectionObserver((es) => es.forEach((e) => {
    e.target.classList.toggle('vis', e.isIntersecting);
    if (e.isIntersecting) e.target.classList.add('play');
  }), { threshold: 0.45 });
  plays.forEach((d) => pio.observe(d));

  // ---------- 析熙的更多：几块可以点的小界面 ----------
  const tone = document.querySelector<HTMLElement>('[data-tone]');
  if (tone) {
    const texts: string[] = JSON.parse(tone.querySelector('[data-tones]')!.textContent!);
    const reply = tone.querySelector<HTMLElement>('[data-reply]')!;
    const bs = [...tone.querySelectorAll<HTMLButtonElement>('[data-i]')];
    // 换档：先出现「正在输入」的三个点，再换成这一档的回复
    let typing = 0;
    const say = (b: HTMLButtonElement) => {
      bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      clearTimeout(typing);
      reply.classList.add('typing'); reply.textContent = '';
      typing = window.setTimeout(() => {
        reply.classList.remove('typing', 'swap'); void reply.offsetWidth; reply.classList.add('swap');
        reply.textContent = texts[Number(b.dataset.i)];
      }, reduce ? 0 : 700);
    };
    let touched = false;
    bs.forEach((b) => b.addEventListener('click', () => { touched = true; say(b); }));
    // 没人点的时候，这块在最前面时自己从低到高轮一遍
    let k = 1;
    setInterval(() => {
      if (reduce || touched || !tone.classList.contains('on') || document.hidden) return;
      k = (k + 1) % bs.length; say(bs[k]);
    }, 3400);
  }
  const mem = document.querySelector<HTMLElement>('[data-memory]');
  if (mem) {
    const card = mem.querySelector<HTMLElement>('.mem')!, done = mem.querySelector<HTMLElement>('.mem-done')!;
    const btn = mem.querySelector<HTMLButtonElement>('[data-forget]')!;
    btn.addEventListener('click', () => {
      const gone = !card.classList.contains('gone');
      card.classList.toggle('gone', gone);
      btn.textContent = gone ? '撤销' : '忘记';
      done.textContent = gone ? '已忘记。之后的对话不再用到它；原来的聊天还在。' : '';
    });
  }
  const model = document.querySelector<HTMLElement>('[data-model]');
  if (model) {
    const bs = [...model.querySelectorAll<HTMLButtonElement>('[data-m]')];
    const views = [...model.querySelectorAll<HTMLElement>('[data-show]')];
    const dest = model.querySelector<HTMLElement>('[data-dest]')!;
    bs.forEach((b) => b.addEventListener('click', () => {
      bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      views.forEach((v) => (v.hidden = v.dataset.show !== b.dataset.m));
      dest.textContent = b.dataset.m === 'local' ? '这台电脑' : 'DeepSeek';
      model.classList.toggle('local', b.dataset.m === 'local');
    }));
  }
  // 心愿：析熙问一句 → 回答在输入框里打出来、发出 → 光点飞进卡片，填上一栏。三栏都填好后才能「加入余时」
  const wish = document.querySelector<HTMLElement>('[data-wish]');
  if (wish) {
    wish.classList.add('live');
    const log = wish.querySelector<HTMLElement>('.wz-log')!;
    const field = wish.querySelector<HTMLElement>('[data-wz-field]')!;
    const send = wish.querySelector<HTMLElement>('.wz-in b')!;
    const fields = [...wish.querySelectorAll<HTMLElement>('.wz-f')];
    const join = wish.querySelector<HTMLButtonElement>('[data-join]')!;
    const tag = wish.querySelector<HTMLElement>('[data-wz-tag]')!;
    const joined = wish.querySelector<HTMLElement>('.wz-joined')!;
    const qa: [string, string][] = [['为什么想学？', '毕业晚会上想弹一首'], ['第一小步可以多小？', '每周两次，每次 20 分钟'], ['还需要准备什么？', '先借一把吉他']];
    const hint = field.textContent!;
    let run = 0;
    const wait = (ms: number, id: number) => new Promise<boolean>((done) => setTimeout(() => done(id === run && wish.classList.contains('on')), reduce ? 0 : ms));
    const bubble = (who: 'ai' | 'me', text: string) => {
      const p = document.createElement('p');
      p.className = `wz-b ${who} pop`;
      p.textContent = text;
      log.append(p);
      return p;
    };
    const reset = () => {
      log.replaceChildren();
      field.textContent = hint; field.classList.remove('typing');
      fields.forEach((f) => f.classList.remove('filled', 'lit'));
      join.disabled = true; join.textContent = '加入余时';
      wish.classList.remove('joined', 'ready');
      tag.textContent = '心愿'; joined.textContent = '';
    };
    const play = async () => {
      const id = ++run;
      reset();
      for (let i = 0; i < qa.length; i++) {
        const [q, ans] = qa[i];
        const dots = bubble('ai', ''); dots.classList.add('typing');
        if (!(await wait(700, id))) return;
        dots.classList.remove('typing'); dots.textContent = q;
        if (!(await wait(500, id))) return;
        // 回答在输入框里逐字打出来
        field.textContent = ''; field.classList.add('typing');
        for (const ch of ans) { if (!(await wait(45, id))) return; field.textContent += ch; }
        if (!(await wait(250, id))) return;
        send.classList.remove('press'); void send.offsetWidth; send.classList.add('press');
        field.textContent = hint; field.classList.remove('typing');
        const me = bubble('me', ans);
        me.classList.add('fly');
        if (!(await wait(650, id))) return;
        fields[i].classList.add('filled', 'lit');
        if (!(await wait(450, id))) return;
      }
      wish.classList.add('ready');
      join.disabled = false;
    };
    join.addEventListener('click', () => {
      wish.classList.add('joined');
      tag.textContent = '余时目标';
      join.disabled = true; join.textContent = '已加入';
      joined.textContent = '已加入余时 · 每周两次 · 每次 20 分钟，按周排进空档';
    });
    wish.querySelector('[data-clarify]')!.addEventListener('click', play);
    // 只在「转到最前面」这一刻播放（记住上一次的状态，避免自己触发自己）
    let wasOn = wish.classList.contains('on');
    new MutationObserver(() => {
      const on = wish.classList.contains('on');
      if (on === wasOn) return;
      wasOn = on;
      if (on) play(); else run++;
    }).observe(wish, { attributes: true, attributeFilter: ['class'] });
  }

  // ---------- 析熙的四个能力：排在地平线上，点一个就转到正上方 ----------
  const orb = document.querySelector<HTMLElement>('[data-orbit]');
  if (orb) {
    orb.classList.add('live');
    const ns = [...orb.querySelectorAll<HTMLButtonElement>('.orb-n')];
    const ps = [...orb.querySelectorAll<HTMLElement>('.mc')];
    const n = ns.length;
    let cur = 0, pos = 0; // pos 是连续的转动量，切换时走最短的方向
    const step = () => parseFloat(getComputedStyle(orb.querySelector('.orb-arc')!).getPropertyValue('--step')) || 15;
    const last: number[] = [];
    const place = () => {
      const st = step();
      ns.forEach((b, k) => {
        let d = k - pos;
        d = ((d % n) + n + n / 2) % n - n / 2; // 落在 [-n/2, n/2)
        // 从一头绕到另一头：先关掉过渡瞬间换位（此时它是隐藏的），不让它横穿画面
        if (last[k] !== undefined && Math.abs(d - last[k]) > 1.5) {
          b.style.transition = 'none';
          b.style.setProperty('--a', `${d * st}deg`);
          void b.offsetWidth;
          b.style.transition = '';
        }
        last[k] = d;
        b.style.setProperty('--a', `${d * st}deg`);
        b.style.opacity = Math.abs(d) >= 1.5 ? '0' : String(1 - Math.abs(d) * 0.4);
        b.tabIndex = Math.abs(d) >= 1.5 ? -1 : 0;
      });
    };
    const stage = orb.querySelector<HTMLElement>('.orb-stage')!;
    const fit = () => { stage.style.height = `${ps[cur].offsetHeight}px`; };
    new ResizeObserver(fit).observe(ps[0].parentElement!);
    ps.forEach((p) => new ResizeObserver(() => p.classList.contains('on') && fit()).observe(p));
    const select = (i: number) => {
      let d = i - cur;
      d = ((d % n) + n + n / 2) % n - n / 2;
      pos += d; cur = ((i % n) + n) % n;
      ns.forEach((b, k) => { b.classList.toggle('on', k === cur); b.setAttribute('aria-pressed', String(k === cur)); });
      ps.forEach((p, k) => { p.classList.toggle('on', k === cur); p.toggleAttribute('inert', k !== cur); });
      fit();
      place();
    };
    // 不点时每 9 秒自己转到下一个；指针在上面、焦点在里面、或不在屏幕上时暂停；点过一次就不再自己转
    let auto = !reduce, hover = false, seen = false, timer = 0;
    // 每块停留的时间：默认 9 秒；心愿要把一整段对话播完再停一会儿，给 16 秒
    const hold = (i: number) => Number(ps[i].dataset.hold || 9000);
    const arm = () => { clearTimeout(timer); if (auto && !hover && seen) timer = window.setTimeout(() => { select(cur + 1); arm(); }, hold(cur)); };
    ns.forEach((b, i) => b.addEventListener('click', () => { auto = false; select(i); }));
    orb.addEventListener('pointerenter', () => { hover = true; arm(); });
    orb.addEventListener('pointerleave', () => { hover = false; arm(); });
    orb.addEventListener('focusin', () => { hover = true; arm(); });
    orb.addEventListener('focusout', () => { hover = false; arm(); });
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; arm(); }, { threshold: 0.4 }).observe(orb);
    addEventListener('resize', place);
    select(0);
  }

  // ---------- 细节区卡片 ----------
  const car = document.querySelector<HTMLElement>('[data-carousel]');
  if (car) {
    const track = car.querySelector<HTMLElement>('.track')!;
    const prev = car.querySelector<HTMLButtonElement>('[data-prev]')!;
    const next = car.querySelector<HTMLButtonElement>('[data-next]')!;
    const step = () => {
      const c = track.querySelector<HTMLElement>('.card')!;
      return c.offsetWidth + parseFloat(getComputedStyle(track).columnGap || '0');
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
    };
    // 按卡片翻页：自己做滑动动画。浏览器自带的平滑滚动会和卡片吸附打架，有时一动不动，
    // 所以滑动期间先关掉吸附，滑到目标卡片后再打开
    let sliding = 0, target = -1;
    const go = (dir: number) => {
      const st = step();
      const max = track.scrollWidth - track.clientWidth;
      const base = target >= 0 ? target : track.scrollLeft; // 连点时从上一次的目标继续
      const to = Math.min(Math.max((Math.round(base / st) + dir) * st, 0), max);
      if (Math.abs(to - track.scrollLeft) < 2) return;
      cancelAnimationFrame(sliding);
      target = to;
      if (reduce) { track.scrollLeft = to; target = -1; update(); return; }
      const from = track.scrollLeft, t0 = performance.now(), dur = 620;
      track.style.scrollSnapType = 'none';
      const tick = (now: number) => {
        const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
        track.scrollLeft = from + (to - from) * e;
        if (k < 1) sliding = requestAnimationFrame(tick);
        else { track.style.scrollSnapType = ''; target = -1; update(); }
      };
      sliding = requestAnimationFrame(tick);
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }
}
