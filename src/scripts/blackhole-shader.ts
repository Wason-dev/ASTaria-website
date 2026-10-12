// 背景黑洞。光线沿 Schwarzschild 测地线步进（rs = 1，光子球 1.5，临界冲击参数 3√3/2）。
// 盘面材质、光子环颜色与色调映射沿用 ASTaria 应用。

export const VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export const FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 o;

uniform vec2 uRes;
uniform float uTime, uDist, uIncl, uYaw, uFov, uExpo;
uniform vec2 uShift;        // 视界在屏幕上的位置（uv）
uniform float uRoll;        // 镜头横滚（弧度），绕视界中心旋转画面
uniform float uStars;       // 星空强度；离屏测量盘面范围时设为 0

const float PI = 3.14159265, TAU = 6.2831853, BCRIT = 2.5980762;

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm2(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }

vec4 disc(vec3 p, vec3 rd){
  float r = length(p.xz);
  float inner = smoothstep(2.95, 3.24, r), outer = 1.0 - smoothstep(8.0, 14.5, r);
  if (inner * outer <= 0.0) return vec4(0);
  float phase = atan(p.z, p.x) - uTime * 1.9 / pow(max(r, 3.0), 1.5);
  vec2 orbit = vec2(cos(phase), sin(phase));
  float turb = fbm2(orbit * 3.7 + vec2(r * 0.45, r * 0.7));
  float rw = r + 0.2 * n2(vec2(r * 1.9, 0.0)) + 0.09 * turb;
  float broad = n2(vec2(rw * 5.1, 0.0) + orbit * 0.28);
  float mid = n2(vec2(rw * 17.3, 4.7) + orbit * 0.44);
  float thin = n2(vec2(rw * 48.0, 11.3) + orbit * 0.7);
  float silk = n2(vec2(rw * 103.0, 21.7) + orbit * 0.55);
  float density = (0.08 + 0.85 * pow(broad, 1.8) + 0.7 * pow(mid, 2.0) + 0.35 * thin + 0.14 * silk) * (0.52 + 0.8 * turb);
  float heat = pow(3.0 / max(r, 3.0), 1.9) * inner * outer;
  float beta = 0.30 * sqrt(3.0 / max(r, 3.0));
  vec3 vel = normalize(vec3(-p.z, 0.0, p.x));
  float dop = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(vel, -rd));
  float radiance = heat * density * pow(dop, 3.0) * 6.7;
  vec3 warm = mix(vec3(0.24, 0.095, 0.029), vec3(1.0, 0.76, 0.46), clamp(heat * 2.0, 0.0, 1.0));
  warm = mix(warm, vec3(1.0, 0.955, 0.86), smoothstep(0.55, 1.3, radiance));
  float opacity = inner * outer * (1.0 - exp(-density * (1.6 + heat * 2.8)));
  return vec4(warm * radiance, opacity);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y - uShift;
  float cr = cos(uRoll), sr = sin(uRoll);
  uv = mat2(cr, -sr, sr, cr) * uv;
  vec3 ro = uDist * vec3(cos(uIncl) * sin(uYaw), sin(uIncl), -cos(uIncl) * cos(uYaw));
  vec3 fw = normalize(-ro), rt = normalize(cross(vec3(0, 1, 0), fw)), up = cross(fw, rt);
  vec3 rd = normalize(fw + uFov * (uv.x * rt + uv.y * up));

  vec3 pos = ro, vel = rd, col = vec3(0);
  float T = 1.0, rmin = 1e9;
  vec3 h = cross(pos, vel);
  float h2 = dot(h, h);
  bool captured = false;
  float far = uDist * 1.35 + 6.0;
  for (int i = 0; i < 260; i++){
    float r = length(pos);
    rmin = min(rmin, r);
    if (r < 1.0){ captured = true; break; }
    if (r > far && dot(pos, vel) > 0.0) break;
    float dt = clamp(0.06 * r, 0.025, 1.4);
    vec3 acc = -1.5 * h2 * pos / pow(r, 5.0);
    vec3 np = pos + vel * dt + 0.5 * acc * dt * dt;
    vel += acc * dt;
    if (np.y * pos.y < 0.0){
      vec3 hit = mix(pos, np, pos.y / (pos.y - np.y));
      vec4 d = disc(hit, normalize(vel));
      col += T * d.rgb * d.a;
      T *= 1.0 - d.a;
    }
    if (T < 0.01) break;
    pos = np;
  }
  float bimp = sqrt(h2);
  if (!captured && T > 0.01){
    vec3 dir = normalize(vel);
    col += T * vec3(0.00045, 0.00055, 0.0008);
    vec2 sp = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0))) * 70.0;
    vec2 cell = floor(sp), f = fract(sp) - 0.5;
    float star = step(0.988, h21(cell + 1.7)) * exp(-dot(f, f) * 60.0) * (0.25 + 0.75 * h21(cell + 9.1));
    col += T * vec3(1.0, 0.94, 0.84) * star * 0.35 * uStars * smoothstep(5.0, 10.0, rmin);
  }
  // 光子环：临界冲击参数处一道亚像素细线和散射肩，颜色与应用相同。
  float edge = abs(bimp - BCRIT);
  float px = 2.0 * uDist * uFov / uRes.y;
  float ring = exp(-0.5 * pow(edge / max(px * 0.9, 0.004), 2.0));
  float shoulder = exp(-edge * 85.0) * 0.16;
  float side = mix(1.0, mix(0.65, 1.6, smoothstep(-0.4, 0.4, uv.x)), cos(uIncl));
  col += vec3(1.0, 0.77, 0.52) * (ring * 0.25 + shoulder) * side * T;

  col *= uExpo;
  col = col / (1.0 + col);
  col = pow(max(col, vec3(0.0)), vec3(0.4545));
  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;
