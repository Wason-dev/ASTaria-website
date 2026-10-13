// Schwarzschild 零测地线查找表（以视界半径为单位）。移植自 ASTaria 应用 src/prototype/geodesics.ts，数学相同。
//
// 每条光线落在「观察者、光线、原点」张成的平面里，逆半径 u = 1/r 满足 u'' + u = 3u²/2（自变量是平面内的角度）。
// 预先用 RK4 把这个方程积分成一张纹理，着色器查表即可得到真实弯曲的光路，不用逐像素步进。
// 横轴是冲击参数 b（立方根映射，把临界光子轨道附近的采样加密），纵轴是角度 φ。
export const CRITICAL_IMPACT = Math.sqrt(27) / 2;

export interface GeodesicLut {
  width: number;
  height: number;
  cameraRadius: number;
  maxImpact: number;
  maxPhi: number;
  /** 每个纹素一个 float：该冲击参数、该角度处的 1/r */
  inverseRadius: Float32Array;
  /** 每个冲击参数一个 RGBA：R = 逃逸或落入视界时的角度，G = 是否被捕获，B = 最近距离，A = 误差 */
  termination: Float32Array;
}

const impactAt = (c: number, maxImpact: number) => {
  const s = 2 * c - 1;
  const span = s < 0 ? CRITICAL_IMPACT : maxImpact - CRITICAL_IMPACT;
  return CRITICAL_IMPACT + span * s * s * s;
};

export function createGeodesicLut(cameraRadius = 30, maxImpact = 24, width = 1024, height = 768, substeps = 4): GeodesicLut {
  const maxPhi = Math.PI * 3;
  const inverseRadius = new Float32Array(width * height);
  const termination = new Float32Array(width * 4);
  const step = maxPhi / (height - 1) / substeps;
  const maxTerminalPhi = Math.PI * 12;

  for (let x = 0; x < width; x++) {
    const impact = impactAt(x / (width - 1), maxImpact);
    let u = 1 / cameraRadius, phi = 0, terminalPhi = 0, ended = false, maxU = u;
    const invB2 = 1 / (impact * impact);
    let v = Math.sqrt(Math.max(0, invB2 - u * u + u * u * u));
    const advance = () => {
      // 四阶 Runge–Kutta 积分精确的轨道方程
      const a1 = 1.5 * u * u - u;
      const u2 = u + v * step * 0.5, v2 = v + a1 * step * 0.5, a2 = 1.5 * u2 * u2 - u2;
      const u3 = u + v2 * step * 0.5, v3 = v + a2 * step * 0.5, a3 = 1.5 * u3 * u3 - u3;
      const u4 = u + v3 * step, v4 = v + a3 * step, a4 = 1.5 * u4 * u4 - u4;
      const nu = u + (step * (v + 2 * v2 + 2 * v3 + v4)) / 6;
      const nv = v + (step * (a1 + 2 * a2 + 2 * a3 + a4)) / 6;
      if (nu <= 0 || nu >= 1) {
        const boundary = nu >= 1 ? 1 : 0;
        terminalPhi = phi + step * Math.max(0, Math.min(1, (boundary - u) / (nu - u)));
        u = boundary; maxU = Math.max(maxU, boundary); ended = true;
      } else { u = nu; v = nv; maxU = Math.max(maxU, u); }
      phi += step;
    };
    for (let y = 0; y < height; y++) {
      if (y > 0 && !ended) for (let i = 0; i < substeps && !ended; i++) advance();
      inverseRadius[y * width + x] = u;
    }
    // 接近临界的背景光线会绕更多圈，继续积分得到真实的出射角
    while (!ended && phi < maxTerminalPhi) advance();
    if (!ended) terminalPhi = maxTerminalPhi;
    termination.set([terminalPhi, impact < CRITICAL_IMPACT ? 1 : 0, 1 / maxU, 0], x * 4);
  }
  return { width, height, cameraRadius, maxImpact, maxPhi, inverseRadius, termination };
}
