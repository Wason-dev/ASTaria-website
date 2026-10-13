// 玻璃的光：每块 [data-glass] 表面都有一个跟随指针的高光（写入 --gx/--gy）。
// 只在指针移动或滚动时更新，静止时不做任何事。
export function mountGlass() {
  const glass = [...document.querySelectorAll<HTMLElement>('[data-glass]')];
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
  };
  requestAnimationFrame(tick);
}
