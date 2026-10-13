// 背景黑洞：天文馆里的天体。它按自己的时钟慢慢转，不跟着滚动走。
//
//   首页开场 [data-cam="fly"]：镜头贴着盘面飞过，往下滑约 0.9 屏拉回全景。
//   文档页的位置和大小由页面上的 [data-hole] 槽位决定：黑洞中心对准槽位中心，盘面宽度刚好落在槽位里，
//   所以它和左侧文字共用同一条网格，左右留白一致，不会出画。方位角极慢地匀速增加，仰角小幅起伏。
//   滚进内容区（[data-dim]）时慢慢压暗（不模糊）；接近结尾再慢慢恢复。
//   结尾 [data-cam="dive"] 约三屏：推进程度由这一段的滚动位置决定，加一层一阶平滑，不会过冲。
import { VERT, FRAG } from './blackhole-shader';
import { createGeodesicLut } from './geodesics';

interface Pose { dist: number; incl: number; yaw: number; fov: number; sx: number; sy: number; expo: number; roll?: number }

const DIST = 30; // 与测地线查找表的镜头半径一致
const DISC_SPAN = 4.2; // 盘面可见的半宽 ≈ 阴影半径 × 4.2（含外圈淡光）
const YAW0 = -0.55;
const YAW_RATE = 0.00055; // 弧度 / 秒，一整圈约 3 小时
const INCL_MID = 0.18, INCL_AMP = 0.10;
const INCL_PERIOD = 140; // 秒
const DIVE_K = 8; // 一阶平滑，约 0.12 秒：快速一甩也不会一下跳到底

const shadowTan = (d: number) => Math.tan(Math.asin(Math.min((2.598 * Math.sqrt(Math.max(1 - 1 / d, 0))) / d, 0.999)));
const logLerp = (a: number, b: number, t: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function mountBlackHole(host: HTMLElement) {
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
  // 测地线查找表：页面打开时算一次（约 300 万步 RK4），之后着色器只查表
  const lut = createGeodesicLut(DIST);
  const linearFloat = !!gl.getExtension('OES_texture_float_linear');
  const tex = (unit: number, w: number, h: number, data: Float32Array, rgba: boolean) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    // 没有浮点线性过滤时退回半精度（WebGL2 核心支持线性过滤）
    const internal = rgba ? (linearFloat ? gl.RGBA32F : gl.RGBA16F) : (linearFloat ? gl.R32F : gl.R16F);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, rgba ? gl.RGBA : gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, rgba ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, rgba ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  tex(0, lut.width, lut.height, lut.inverseRadius, false);
  tex(1, lut.width, 1, lut.termination, true);
  gl.uniform1i(gl.getUniformLocation(prog, 'uGeo'), 0);
  gl.uniform1i(gl.getUniformLocation(prog, 'uTerm'), 1);
  gl.uniform2f(gl.getUniformLocation(prog, 'uLutSize'), lut.width, lut.height);
  gl.uniform1f(gl.getUniformLocation(prog, 'uMaxPhi'), lut.maxPhi);
  gl.uniform1f(gl.getUniformLocation(prog, 'uMaxImpact'), lut.maxImpact);
  gl.uniform1f(gl.getUniformLocation(prog, 'uLutR'), lut.cameraRadius);
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
    gl.uniform1f(U.uRoll, p.roll ?? 0);
    gl.uniform1f(U.uStars, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  let W = innerWidth, H = innerHeight;
  const size = () => {
    W = innerWidth; H = innerHeight;
    // 渲染分辨率：桌面 0.9 倍，细丝不糊；窄屏 0.6 倍省电
    const k = Math.min(devicePixelRatio, 2) * (W < 760 ? 0.6 : 0.9);
    canvas.width = Math.round(W * k);
    canvas.height = Math.round(H * k);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  size();
  addEventListener('resize', size);

  const diveEl = document.querySelector<HTMLElement>('[data-cam="dive"]');
  // 首页开场：镜头贴着盘面飞过（像应用首页那样），往下滑拉回全景
  const flyEl = document.querySelector<HTMLElement>('[data-cam="fly"]');
  const dimEl = document.querySelector<HTMLElement>('[data-dim]');
  // 槽位：按页面顶部时的位置量一次（黑洞固定在背景里，不随滚动移动）
  const slotEl = document.querySelector<HTMLElement>('[data-hole]');
  let slot = { cx: 0, cy: 0, r: 0 };
  const measure = () => {
    // 没有槽位时（首页）：与应用首页「全景」同一构图——黑洞在横向约 65% 处，阴影约屏高的 12%
    if (!slotEl) { const portrait = W / H < 0.95; slot = { cx: W * (portrait ? 0.5 : 0.65), cy: H * (portrait ? 0.36 : 0.49), r: H * (portrait ? 0.1 : 0.12) }; return; }
    const b = slotEl.getBoundingClientRect();
    const top = b.top + scrollY;
    slot = { cx: b.left + b.width / 2, cy: top + b.height / 2, r: Math.min(b.width / 2 / DISC_SPAN, b.height / 2 / 2.6) };
  };
  measure();
  addEventListener('resize', measure);
  addEventListener('load', measure);
  document.fonts?.ready.then(measure);
  const shadowEls = [...document.querySelectorAll<HTMLElement>('[data-in-shadow]')];
  const t0 = performance.now();
  let dive = 0, dim = 0, dimShown = -1, hp = 0, hpShown = -1, last = t0;

  const sky = (now: number): Pose => {
    const t = (now - t0) / 1000;
    const dist = DIST;
    const fov = shadowTan(dist) / Math.max(slot.r / H, 0.02);
    return {
      dist, fov,
      incl: still ? INCL_MID : INCL_MID + INCL_AMP * Math.sin((2 * Math.PI * t) / INCL_PERIOD),
      yaw: YAW0 + (still ? 0 : YAW_RATE * t),
      sx: (slot.cx - W / 2) / H,
      sy: (H / 2 - slot.cy) / H,
      expo: 1.0,
      roll: slotEl ? 0 : 0.18,
    };
  };
  // 飞跃：照应用首页展开聊天时的「星际」机位——距离不变，换长焦：阴影约占屏高一半，
  // 中心几乎贴着右边缘，镜头略微横滚，几乎平视盘面，光带从左边和下方扫过。
  const fly = (from: Pose): Pose => {
    const a = W / H, portrait = a < 0.95;
    return {
      dist: from.dist, fov: shadowTan(from.dist) / (portrait ? 0.3 : 0.52), incl: 0.1, yaw: from.yaw,
      sx: portrait ? 0.18 : a * 0.48, sy: portrait ? 0.22 : 0.0, expo: 1.0, roll: 0.12,
    };
  };
  const inside = (from: Pose): Pose => {
    // 真正飞进去：距离从 30 缩到 3.2，镜头转向俯视，阴影长到盖满整个屏幕
    const dist = 3.2;
    const vf = (shadowTan(dist) / Math.hypot(W / H / 2, 0.5)) * 0.85;
    return { dist, fov: vf, incl: 1.36, yaw: from.yaw, sx: 0, sy: 0, expo: 1.05, roll: 0 };
  };

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const c01 = (v: number) => Math.min(Math.max(v, 0), 1);
    // 推进进度：这一段顶部到屏幕下方 10% 时开始，滚过这一段 80% 的高度时全黑
    let want = 0, diveTop = Infinity;
    if (diveEl) {
      const b = diveEl.getBoundingClientRect();
      diveTop = b.top;
      want = c01((H * 0.9 - b.top) / (b.height * 0.8));
    }
    dive = still ? want : dive + (want - dive) * (1 - Math.exp(-DIVE_K * dt));
    if (diveEl) {
      diveEl.style.setProperty('--dv', dive.toFixed(3)); // 结尾的下载随全黑程度显现
      diveEl.classList.toggle('dark', dive > 0.84);      // 显现之前不可点击
    }
    // 内容区压暗：内容区顶部到屏幕下方 10% 时开始、约 0.8 屏压下去（首页此时已拉回全景）；
    // 越过视界那一段进入屏幕时才开始、用 1.4 屏慢慢恢复
    if (dimEl) {
      const into = c01((H * 0.9 - dimEl.getBoundingClientRect().top) / (H * 0.8));
      const out = c01((H * 1.6 - diveTop) / (H * 1.4));
      const dWant = into * (1 - out);
      dim = still ? dWant : dim + (dWant - dim) * (1 - Math.exp(-6 * dt));
      const q = Math.round(dim * 100) / 100;
      if (q !== dimShown) {
        dimShown = q;
        canvas.style.filter = q > 0 ? `brightness(${(1 - 0.5 * q).toFixed(2)})` : ''; // 只压暗，不模糊
        host.style.setProperty('--dim', String(q));
      }
    }
    // 拉回全景：滑过约 0.9 屏完成。一阶平滑，不会过冲。进度写进 --hp，开场玻璃板据此淡出
    if (flyEl) {
      const hWant = c01(scrollY / (H * 0.9));
      hp = still ? hWant : hp + (hWant - hp) * (1 - Math.exp(-8 * dt));
      const q = Math.round(hp * 1000) / 1000;
      if (q !== hpShown) { hpShown = q; document.documentElement.style.setProperty('--hp', String(q)); }
    }
    const pano = sky(now);
    let s = pano;
    if (flyEl && hp < 1) {
      const f = fly(pano), k = hp * hp * (3 - 2 * hp);
      s = { dist: logLerp(f.dist, pano.dist, k), fov: logLerp(f.fov, pano.fov, k), incl: mix(f.incl, pano.incl, k), yaw: pano.yaw, sx: mix(f.sx, pano.sx, k), sy: mix(f.sy, pano.sy, k), expo: mix(f.expo, pano.expo, k), roll: mix(f.roll ?? 0, pano.roll ?? 0, k) };
    }
    const i = inside(s);
    const u = dive * dive * (3 - 2 * dive);
    const p: Pose = {
      dist: logLerp(s.dist, i.dist, u),
      fov: logLerp(s.fov, i.fov, u),
      incl: mix(s.incl, i.incl, u),
      yaw: s.yaw,
      sx: mix(s.sx, i.sx, u),
      sy: mix(s.sy, i.sy, u),
      roll: mix(s.roll ?? 0, 0, u),
      expo: s.expo * (still ? 1 : 1 - Math.pow(1 - Math.min((now - t0) / 2800, 1), 3)),
    };
    draw(p, still ? 12 : now / 1000, canvas.width, canvas.height);
    if (shadowEls.length) {
      const cx = W / 2 + p.sx * H, cy = H / 2 - p.sy * H, Rpx = (shadowTan(p.dist) / p.fov) * H;
      for (const el of shadowEls) {
        const b = el.getBoundingClientRect();
        if (b.bottom < 0 || b.top > H) continue;
        const d = Math.max(Math.hypot(b.left - cx, b.top - cy), Math.hypot(b.right - cx, b.bottom - cy));
        el.style.opacity = (1 - Math.min(Math.max((d / Math.max(Rpx, 1) - 0.8) / 0.16, 0), 1)).toFixed(3);
      }
    }
  };
  requestAnimationFrame(frame);
  return true;
}
