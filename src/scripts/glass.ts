// 玻璃的光：每块 [data-glass] 表面都有一个跟随指针的高光（写入 --gx/--gy），
// 每块 [data-slab] 从底部进入时由轻微后仰转正，之后保持端正（写入 --rx）。
export function mountGlass() {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glass = [...document.querySelectorAll<HTMLElement>('[data-glass]')];
  const slabs = [...document.querySelectorAll<HTMLElement>('[data-slab]')].map((el, i) => ({
    el,
    pane: el.querySelector<HTMLElement>('.slab-glass')!,
    side: el.closest('.flip') ? -1 : el.classList.contains('s-front') ? -1 : i % 2 ? -1 : 1,
  }));

  let mx = innerWidth / 2, my = innerHeight / 2, dirty = true;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; dirty = true; }, { passive: true });
  addEventListener('scroll', () => (dirty = true), { passive: true });
  addEventListener('resize', () => (dirty = true));

  const tick = () => {
    requestAnimationFrame(tick);
    if (!dirty) return;
    dirty = false;
    const vh = innerHeight;
    for (const g of glass) {
      const r = g.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      g.style.setProperty('--gx', `${(((mx - r.left) / r.width) * 100).toFixed(1)}%`);
      g.style.setProperty('--gy', `${(((my - r.top) / r.height) * 100).toFixed(1)}%`);
    }
    if (still) return;
    for (const s of slabs) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      // p: -1 刚从底部进入 · 0 位于视口中央 · 1 从顶部离开
      const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)));
      // 进入时从后仰、略小、略低处升起转正；中段完全端正；离开时轻轻前倾远去。
      // 这里不加阻尼：它直接由滚动决定，与黑洞镜头同步，滚动停下它就停下。
      const inE = Math.pow(Math.max(p, 0), 1.6), outE = Math.pow(Math.max(-p - 0.2, 0) / 0.8, 1.6);
      s.pane.style.setProperty('--rx', `${(inE * 16 - outE * 6).toFixed(2)}deg`);
      s.pane.style.setProperty('--ry', '0deg');
      s.pane.style.setProperty('--ty', `${(inE * 60).toFixed(1)}px`);
      s.pane.style.setProperty('--sc', (1 - inE * 0.08 - outE * 0.04).toFixed(4));
    }
  };
  requestAnimationFrame(tick);
}
