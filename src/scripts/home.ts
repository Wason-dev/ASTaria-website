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
    bs.forEach((b) => b.addEventListener('click', () => {
      bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      reply.classList.remove('swap'); void reply.offsetWidth; reply.classList.add('swap');
      reply.textContent = texts[Number(b.dataset.i)];
    }));
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
    bs.forEach((b) => b.addEventListener('click', () => {
      bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      views.forEach((v) => (v.hidden = v.dataset.show !== b.dataset.m));
    }));
  }
  const wish = document.querySelector<HTMLElement>('[data-wish]');
  if (wish) {
    wish.classList.add('live');
    const btn = wish.querySelector<HTMLButtonElement>('[data-clarify]')!;
    btn.addEventListener('click', () => {
      const open = !wish.classList.contains('open');
      wish.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? '收起' : '聊清楚';
    });
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
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }
}
