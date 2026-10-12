// 功能展示：一个吸顶的舞台，五章依次登场。
//   · 滚动位置直接决定每章的进场与退场（每帧计算，无延迟、无自动播放），相邻两章交叉过渡
//   · 截图玻璃和文案玻璃是两片，指针移动时以不同深度轻微视差（阻尼跟随，不抖）
//   · 右侧章节导轨可点击跳转，进度条随滚动填充
// 窄屏、无 JS、减少动态效果时不启用：五章按普通文档流依次排列。
export function mountShowcase() {
  const show = document.getElementById('show');
  if (!show || !matchMedia('(min-width: 900px)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slides = [...show.querySelectorAll<HTMLElement>('.slide')];
  const ticks = [...show.querySelectorAll<HTMLButtonElement>('[data-go]')];
  const stage = show.querySelector<HTMLElement>('.stage')!;
  const n = slides.length;
  show.classList.add('pinned');

  let top = 0, len = 1;
  const measure = () => {
    top = show.getBoundingClientRect().top + scrollY;
    len = Math.max(show.offsetHeight - innerHeight, 1);
  };
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);

  let active = -1;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    slides.forEach((s, k) => {
      s.classList.toggle('is-on', k === i);
      s.classList.toggle('is-past', k < i);
      s.toggleAttribute('inert', k !== i);
    });
    ticks.forEach((t, k) => t.setAttribute('aria-current', k === i ? 'step' : 'false'));
  };

  ticks.forEach((t, k) =>
    t.addEventListener('click', () => scrollTo({ top: top + ((k + 0.5) / n) * len, behavior: reduce ? 'auto' : 'smooth' })),
  );

  // 指针视差：两片玻璃在不同深度，阻尼跟随
  let mx = 0, my = 0, cx = 0, cy = 0;
  if (!reduce && matchMedia('(hover: hover)').matches)
    addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  let last = performance.now();
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const p = Math.min(Math.max((scrollY - top) / len, 0), 0.9999);
    setActive(Math.floor(p * n));
    const local = p * n - Math.floor(p * n); // 当前章节内的进度 0..1
    // 每章的进场 / 退场进度：章与章之间 30% 的重叠交叉过渡；第一章开场即在，最后一章不退场
    const W = 0.3;
    slides.forEach((s, i) => {
      const u = p * n - i;
      const e = i === 0 ? 1 : Math.min(Math.max((u + W) / W, 0), 1);
      const x = i === n - 1 ? 0 : Math.min(Math.max((u - (1 - W)) / W, 0), 1);
      const ee = e * e * (3 - 2 * e), xx = x * x * (3 - 2 * x);
      s.style.setProperty('--e', ee.toFixed(4));
      s.style.setProperty('--x', xx.toFixed(4));
      // 每章自己的漂移进度：跨章时连续，不会因为换章而跳动
      s.style.setProperty('--u', Math.min(Math.max(u, -0.4), 1.4).toFixed(4));
    });
    const k = 1 - Math.exp(-dt * 4);
    cx += (mx - cx) * k; cy += (my - cy) * k;
    stage.style.setProperty('--p', p.toFixed(4));
    stage.style.setProperty('--local', local.toFixed(4));
    stage.style.setProperty('--mx', cx.toFixed(4));
    stage.style.setProperty('--my', cy.toFixed(4));
  };
  requestAnimationFrame(tick);
}
