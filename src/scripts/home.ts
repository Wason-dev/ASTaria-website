// 首页交互：功能区标签（点击切换 + 自动轮播）和细节区横向卡片。
// 没有 JS 时：功能区五个画面按顺序排开，卡片可以直接横向滑动。
export function mountHome() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 功能区标签 ----------
  const root = document.querySelector<HTMLElement>('[data-tabs]');
  if (root) {
    root.classList.add('live');
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    const ind = root.querySelector<HTMLElement>('.tab-ind')!;
    const bar = ind.querySelector('i')!;
    let cur = 0;
    let auto = !reduce; // 用户点过一次之后就不再自动轮播

    const place = () => {
      const t = tabs[cur];
      ind.style.setProperty('--x', `${t.offsetLeft}px`);
      ind.style.setProperty('--w', `${t.offsetWidth}px`);
    };
    const restartBar = () => {
      bar.classList.remove('run');
      void bar.offsetWidth; // 重新开始填充动画
      if (auto) bar.classList.add('run');
    };
    const select = (i: number, focus = false) => {
      cur = (i + tabs.length) % tabs.length;
      tabs.forEach((t, k) => {
        const on = k === cur;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[k].classList.toggle('on', on);
        panels[k].toggleAttribute('inert', !on);
        panels[k].setAttribute('aria-hidden', String(!on));
      });
      if (focus) tabs[cur].focus();
      place();
      restartBar();
    };

    tabs.forEach((t, i) => t.addEventListener('click', () => { auto = false; root.classList.add('manual'); select(i); }));
    root.querySelector('[role="tablist"]')!.addEventListener('keydown', (e) => {
      const k = (e as KeyboardEvent).key;
      if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'Home' && k !== 'End') return;
      e.preventDefault();
      auto = false; root.classList.add('manual');
      select(k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : cur + (k === 'ArrowRight' ? 1 : -1), true);
    });
    bar.addEventListener('animationend', () => auto && select(cur + 1));
    // 指针停在上面、键盘焦点在里面、或滚出屏幕时，轮播暂停
    const pause = (on: boolean) => root.classList.toggle('paused', on);
    root.addEventListener('pointerenter', () => pause(true));
    root.addEventListener('pointerleave', () => pause(false));
    root.addEventListener('focusin', () => pause(true));
    root.addEventListener('focusout', () => pause(false));
    new IntersectionObserver(([e]) => root.classList.toggle('offscreen', !e.isIntersecting), { threshold: 0.35 }).observe(root);
    addEventListener('resize', place);
    document.fonts?.ready.then(place);
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
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }
}
