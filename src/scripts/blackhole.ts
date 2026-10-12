// 背景黑洞：一条完整的飞行路线，随滚动推进。
//
//   远处侧视 → 一边靠近一边环绕，抬到斜上方 → 压低掠过盘面 → 俯冲进阴影，整屏变黑，之后留在黑暗里
//
// 黑洞始终在画面中央附近，不躲任何东西；内容放在玻璃卡片上，玻璃负责可读性。
// 距离只减不增、阴影只大不小、方位匀速转动、仰角只有一个起伏。所有量都只朝一个方向走。
import { VERT, FRAG } from './blackhole-shader';

interface Pose { dist: number; incl: number; yaw: number; fov: number; sx: number; sy: number; expo: number }

const D0 = 42, D1 = 16;                // 接近段：起点、终点距离（rs）
const YAW0 = -0.6, YAW_SPAN = 2.4;     // 环绕总角度
const R0 = 0.13, R1 = 0.3;             // 阴影半径（屏高），只增不减

const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const shadowTan = (d: number) => Math.tan(Math.asin(Math.min((2.598 * Math.sqrt(Math.max(1 - 1 / d, 0))) / d, 0.999)));
const logLerp = (a: number, b: number, t: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

/** 接近段：t ∈ [0,1]。 */
function approach(t: number): Pose {
  const dist = D0 * Math.pow(D1 / D0, t);
  const R = R0 + (R1 - R0) * smooth(0, 1, t);
  // 仰角一个起伏：侧视 → 斜上方（t≈0.45 最高）→ 压低掠过
  const incl = 0.07 + 0.55 * Math.pow(Math.sin(Math.PI * Math.min(t / 0.9, 1)), 1.5);
  return {
    dist, incl, yaw: YAW0 + YAW_SPAN * t, fov: shadowTan(dist) / R,
    sx: 0, sy: -0.14 * (1 - smooth(0, 0.35, t)), // 开场黑洞略低，标题在它上方；随后升到正中
    expo: 1.05,
  };
}

export function mountBlackHole(host: HTMLElement, opts: { span?: number } = {}) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return false;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const prog = gl.createProgram()!;
  try {
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) {
    console.warn('[ASTaria] 黑洞背景不可用', e);
    return false;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(
    ['uRes', 'uTime', 'uDist', 'uIncl', 'uYaw', 'uFov', 'uExpo', 'uShift', 'uRoll', 'uStars'].map((n) => [n, gl.getUniformLocation(prog, n)]),
  );
  const draw = (p: Pose, time: number, w: number, h: number) => {
    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uDist, p.dist);
    gl.uniform1f(U.uIncl, p.incl);
    gl.uniform1f(U.uYaw, p.yaw);
    gl.uniform1f(U.uFov, p.fov);
    gl.uniform1f(U.uExpo, p.expo);
    gl.uniform2f(U.uShift, p.sx, p.sy);
    gl.uniform1f(U.uRoll, 0);
    gl.uniform1f(U.uStars, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  let W = innerWidth, H = innerHeight;
  const size = () => {
    W = innerWidth; H = innerHeight;
    const k = Math.min(devicePixelRatio, 2) * (W < 760 ? 0.6 : 0.72);
    canvas.width = Math.round(W * k);
    canvas.height = Math.round(H * k);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  // ---------- 滚动 → 路线 ----------
  const span = opts.span ?? 1;
  let diveTop = 1, voidAt = 2, revealAt = 3, hasDive = false;
  const measure = () => {
    size();
    const abs = (el: Element | null) => (el ? el.getBoundingClientRect().top + scrollY : 0);
    const dive = document.querySelector('[data-cam="dive"]'), vd = document.querySelector('[data-cam="void"]'), rv = document.querySelector('[data-cam="reveal"]');
    hasDive = !!(dive && vd && rv);
    diveTop = hasDive ? abs(dive) - H * 0.6 : Math.max(document.documentElement.scrollHeight - H, 1);
    voidAt = abs(vd) - H * 0.1;
    revealAt = abs(rv) - H * 0.4;
  };
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  document.fonts?.ready.then(measure);

  const poseAt = (y: number): Pose => {
    const end = approach(span);
    if (!hasDive || y <= diveTop) return approach(clamp01(y / Math.max(diveTop, 1)) * span);
    const rate = (YAW_SPAN * span) / Math.max(diveTop, 1); // 穿过视界时保持同样的转速
    // 俯冲：继续靠近，镜头转向正对黑洞，阴影长大到盖满整屏；之后一直留在视界里，整屏黑
    const u = clamp01((y - diveTop) / Math.max(voidAt - diveTop, 1));
    const e = 0.3 * u + 0.7 * u * u * (3 - 2 * u);
    const vd = 3.2, vf = (shadowTan(vd) / Math.hypot(W / H / 2, 0.5)) * 0.85;
    return {
      dist: logLerp(end.dist, vd, e), fov: logLerp(end.fov, vf, e),
      incl: end.incl + (1.36 - end.incl) * smooth(0.25, 1, u),
      sx: 0, sy: end.sy * (1 - u), yaw: end.yaw + rate * (y - diveTop), expo: 1.05,
    };
  };

  // ---------- 渲染 ----------
  const shadowEls = [...document.querySelectorAll<HTMLElement>('[data-in-shadow]')];
  const t0 = performance.now();
  // 只对滚动位置做一阶指数平滑：只抹掉滚轮的颗粒感。一阶平滑永远不会过冲，不会回弹。
  let y = scrollY, last = t0;
  const K = 30; // 时间常数约 33ms：快速甩动时也贴着手走
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    y = still ? scrollY : y + (scrollY - y) * (1 - Math.exp(-K * dt));
    const p = poseAt(y);
    const e = still ? 1 : 1 - Math.pow(1 - Math.min((now - t0) / 3000, 1), 3); // 开场：从更远处推近、亮起
    const shown = { ...p, dist: p.dist * (1 + 0.35 * (1 - e)), expo: p.expo * e };
    draw(shown, still ? 12 : now / 1000, canvas.width, canvas.height);
    if (shadowEls.length) {
      // 阴影里的字：被阴影完全包住时才显现
      const cx = W / 2 + p.sx * H, cy = H / 2 - p.sy * H, R = (shadowTan(shown.dist) / p.fov) * H;
      for (const el of shadowEls) {
        const b = el.getBoundingClientRect();
        if (b.bottom < 0 || b.top > H) continue;
        const d = Math.max(Math.hypot(b.left - cx, b.top - cy), Math.hypot(b.right - cx, b.bottom - cy), Math.hypot(b.left - cx, b.bottom - cy), Math.hypot(b.right - cx, b.top - cy));
        el.style.opacity = (1 - smooth(0.8, 0.96, d / Math.max(R, 1))).toFixed(3);
      }
    }
  };
  requestAnimationFrame(frame);

  if (import.meta.env.DEV) {
    // 开发用：沿整页均匀取 n 帧，拼成一张分镜图叠在页面上
    const fbo = gl.createFramebuffer()!, tex = gl.createTexture()!;
    const storyboard = (n = 12, cols = 4) => {
      const max = document.documentElement.scrollHeight - H, tw = 360, th = Math.round((tw * H) / W);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, tw, th);
      const sheet = document.createElement('canvas');
      sheet.width = cols * tw; sheet.height = Math.ceil(n / cols) * (th + 16);
      const g = sheet.getContext('2d')!;
      g.fillStyle = '#111'; g.fillRect(0, 0, sheet.width, sheet.height);
      const px = new Uint8Array(tw * th * 4);
      for (let k = 0; k < n; k++) {
        const sy = (max * k) / (n - 1), p = poseAt(sy);
        draw(p, 10, tw, th);
        gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const img = g.createImageData(tw, th);
        for (let r = 0; r < th; r++) img.data.set(px.subarray((th - 1 - r) * tw * 4, (th - r) * tw * 4), r * tw * 4);
        const x0 = (k % cols) * tw, y0 = Math.floor(k / cols) * (th + 16);
        g.putImageData(img, x0, y0);
        g.fillStyle = '#ccc'; g.font = '11px monospace';
        g.fillText(`${k} y=${Math.round(sy)} d=${p.dist.toFixed(1)} incl=${p.incl.toFixed(2)} R=${(shadowTan(p.dist) / p.fov).toFixed(2)}`, x0 + 4, y0 + th + 12);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      document.getElementById('__sb')?.remove();
      sheet.id = '__sb';
      sheet.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;width:100vw;pointer-events:none';
      document.body.append(sheet);
    };
    (window as unknown as { __cam: unknown }).__cam = { poseAt, storyboard };
  }
  return true;
}
