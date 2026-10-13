// 背景黑洞：天文馆里的天体。它按自己的时钟慢慢转，不跟着滚动走。
//
//   整页只有一个位置、一个大小。方位角极慢地匀速增加，仰角在一个很小的范围内起伏。
//   滚到结尾（[data-cam="inside"]）时，镜头用约 3 秒缓缓推进阴影，画面变黑；
//   往回滚，同样用约 3 秒退出来。这一段按时间走，和滑动速度无关。
import { VERT, FRAG } from './blackhole-shader';

interface Pose { dist: number; incl: number; yaw: number; fov: number; sx: number; sy: number; expo: number }

const DIST = 32;
const R = 0.09; // 阴影半径（屏高）
const YAW0 = -0.55;
const YAW_RATE = 0.00055; // 弧度 / 秒，一整圈约 3 小时
const INCL_MID = 0.18, INCL_AMP = 0.10;
const INCL_PERIOD = 140; // 秒
const DIVE_K = 1.15; // 约 3 秒到位

const shadowTan = (d: number) => Math.tan(Math.asin(Math.min((2.598 * Math.sqrt(Math.max(1 - 1 / d, 0))) / d, 0.999)));
const logLerp = (a: number, b: number, t: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function mountBlackHole(host: HTMLElement, opts: { offset?: boolean } = {}) {
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
  size();
  addEventListener('resize', size);

  const insideEl = document.querySelector('[data-cam="inside"]');
  const shadowEls = [...document.querySelectorAll<HTMLElement>('[data-in-shadow]')];
  const t0 = performance.now();
  let dive = 0, last = t0;

  const sky = (now: number): Pose => {
    const t = (now - t0) / 1000;
    const a = W / H;
    const dist = DIST;
    const fov = shadowTan(dist) / R;
    const portrait = a < 0.95;
    return {
      dist, fov,
      incl: still ? INCL_MID : INCL_MID + INCL_AMP * Math.sin((2 * Math.PI * t) / INCL_PERIOD),
      yaw: YAW0 + (still ? 0 : YAW_RATE * t),
      sx: opts.offset && !portrait ? Math.min(a * 0.3, 0.52) : 0,
      sy: portrait ? 0.26 : opts.offset ? 0.2 : 0.22,
      expo: 1.05,
    };
  };
  const inside = (from: Pose): Pose => {
    const dist = 3.2;
    const vf = (shadowTan(dist) / Math.hypot(W / H / 2, 0.5)) * 0.85;
    return { dist, fov: vf, incl: 1.36, yaw: from.yaw, sx: 0, sy: 0, expo: 1.05 };
  };

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const want = insideEl && insideEl.getBoundingClientRect().top < H * 0.55 ? 1 : 0;
    dive = still ? want : dive + (want - dive) * (1 - Math.exp(-DIVE_K * dt));
    const s = sky(now);
    const i = inside(s);
    const u = dive * dive * (3 - 2 * dive);
    const p: Pose = {
      dist: logLerp(s.dist, i.dist, u),
      fov: logLerp(s.fov, i.fov, u),
      incl: mix(s.incl, i.incl, u),
      yaw: s.yaw,
      sx: mix(s.sx, i.sx, u),
      sy: mix(s.sy, i.sy, u),
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
