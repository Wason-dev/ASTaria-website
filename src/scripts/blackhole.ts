// 背景黑洞：一条连续的接近轨道。所有量都只朝一个方向变化，没有来回。
//
//   距离：按几何级数匀速缩短（一直在靠近）
//   大小：阴影半径随进度单调变大（只放大，不缩回）
//   方位：匀速环绕
//   仰角：一个来回——侧视 → 斜上方 → 侧视
//   位置：开场在右侧（左边是标题），随后滑到画面中央并停在那里，之后不再横移
//
// 章节里，截图板正好挡在黑洞前面，黑洞的光从玻璃四周和背后透出来。
// 最后越过视界：阴影吞没整屏，再在黑暗中切回远景。
import { VERT, FRAG } from './blackhole-shader';

interface Pose { dist: number; incl: number; yaw: number; fov: number; sx: number; sy: number; expo: number }

const D0 = 40, D1 = 17;             // 起点、终点距离（rs）
const YAW0 = -0.55, YAW_SPAN = 2.2; // 环绕总角度
const R0 = 0.10, R1 = 0.2;          // 阴影半径（屏高）：起点 → 终点，单调增加

const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const shadowTan = (d: number) => Math.tan(Math.asin(Math.min((2.598 * Math.sqrt(Math.max(1 - 1 / d, 0))) / d, 0.999)));

/** 轨道：进度 t ∈ [0,1]，arrive ∈ [0,1] 是从开场位置滑到中央的程度。 */
function orbit(t: number, arrive: number, a: number): Pose {
  const portrait = a < 0.95;
  const dist = D0 * Math.pow(D1 / D0, t);
  const R = R0 + (R1 - R0) * smooth(0, 1, t);
  const hump = Math.sin(Math.PI * smooth(0, 1, t));
  const k = smooth(0, 1, arrive);
  const sx0 = portrait ? 0 : Math.min(a * 0.25, 0.46);
  const sy0 = portrait ? 0.24 : 0.02;
  return {
    dist,
    incl: 0.08 + 0.42 * hump,
    yaw: YAW0 + YAW_SPAN * t,
    fov: shadowTan(dist) / R,
    sx: sx0 * (1 - k),
    sy: sy0 + (portrait ? 0 : -0.02) * k,
    expo: 1.05,
  };
}

export function mountBlackHole(host: HTMLElement, opts: { span?: number; stay?: boolean } = {}) {
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
  let W = innerWidth, H = innerHeight, a = W / H;
  const size = () => {
    W = innerWidth; H = innerHeight; a = W / H;
    const k = Math.min(devicePixelRatio, 2) * (W < 760 ? 0.6 : 0.72);
    canvas.width = Math.round(W * k);
    canvas.height = Math.round(H * k);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  size();

  // ---------- 滚动 → 轨道 ----------
  const span = opts.span ?? 1;
  let arriveEnd = 1, diveTop = 1, voidAt = 2, revealAt = 3, hasDive = false;
  const measure = () => {
    size();
    const abs = (el: Element | null) => (el ? el.getBoundingClientRect().top + scrollY : 0);
    const first = document.querySelector('[data-cam="first"]');
    const dive = document.querySelector('[data-cam="dive"]'), vd = document.querySelector('[data-cam="void"]'), rv = document.querySelector('[data-cam="reveal"]');
    hasDive = !!(dive && vd && rv);
    diveTop = hasDive ? abs(dive) - H : Math.max(document.documentElement.scrollHeight - H, 1);
    voidAt = abs(vd) - H * 0.1;
    revealAt = abs(rv) - H * 0.35;
    // 开场到第一章：黑洞从右侧滑到中央，在第一章的截图到达之前就位
    arriveEnd = opts.stay ? Infinity : first ? Math.max(abs(first) - H * 0.2, H * 0.5) : H;
  };
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  document.fonts?.ready.then(measure);

  const approach = (y: number) => orbit((Math.min(Math.max(y / Math.max(diveTop, 1), 0), 1)) * span, Math.min(Math.max(y / arriveEnd, 0), 1), a);
  const poseAt = (y: number): Pose => {
    if (!hasDive || y <= diveTop) return approach(y);
    const end = approach(diveTop);
    const rate = (YAW_SPAN * span) / Math.max(diveTop, 1); // 方位角保持同样的转速穿过视界
    if (y < revealAt) {
      const u = Math.min((y - diveTop) / Math.max(voidAt - diveTop, 1), 1);
      const e = 0.3 * u + 0.7 * u * u * (3 - 2 * u);
      const vd = 3.2, vf = (shadowTan(vd) / Math.hypot(a / 2, 0.5)) * 0.85;
      return {
        dist: Math.exp(Math.log(end.dist) + (Math.log(vd) - Math.log(end.dist)) * e),
        fov: Math.exp(Math.log(end.fov) + (Math.log(vf) - Math.log(end.fov)) * e),
        incl: end.incl + (1.36 - end.incl) * smooth(0.2, 1, u),
        sx: end.sx * (1 - smooth(0, 0.8, u)), sy: end.sy * (1 - smooth(0, 0.8, u)),
        yaw: end.yaw + rate * (y - diveTop), expo: 1.05,
      };
    }
    // 切镜：在黑暗里换到与开场呼应的远景（黑洞在右，文字在左），缓缓推近、亮起
    const o = orbit(0, 0, a), u = smooth(revealAt, revealAt + H * 0.7, y);
    return { ...o, dist: o.dist * (1.4 - 0.4 * u), yaw: YAW0 + YAW_SPAN + 1.2 + rate * (y - revealAt), expo: 1.15 * u };
  };

  /*__RENDER__*/
}
