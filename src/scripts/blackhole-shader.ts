// 背景黑洞。移植自 ASTaria 应用 src/prototype/shaders.ts 的做法（应用源码不改）：
//   · 光线不逐像素步进，而是查 Schwarzschild 测地线表（scripts/geodesics.ts），在真实弯曲的光路上
//     找出与盘面的前三次交点（主像 + 两次透镜像），视界轮廓按临界冲击参数几何地画出，边缘不会糊、不会偏。
//   · 盘面材质（多尺度丝流、开普勒转速、多普勒增亮、两份有限年龄的流场交替）、光子环与色调映射与应用一致。
// 单位：视界半径 rs = 1，ISCO = 3，临界冲击参数 3√3/2。表按镜头半径 30 生成；镜头飞近时沿同一轨道接着积分。

export const VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export const FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
out vec4 o;

uniform vec2 uRes;
uniform float uTime, uDist, uIncl, uYaw, uFov, uExpo;
uniform vec2 uShift;        // 视界在屏幕上的位置（屏高为单位）
uniform float uRoll;        // 镜头横滚（弧度），绕视界中心旋转画面
uniform float uStars;       // 星空强度
uniform sampler2D uGeo;     // 1/r，横轴冲击参数（立方根映射），纵轴角度
uniform sampler2D uTerm;    // R = 出射角，G = 是否被捕获
uniform vec2 uLutSize;
uniform float uMaxPhi, uMaxImpact, uLutR; // uLutR：查找表的镜头半径（30）

const float PI = 3.14159265359;
const float BCRIT = 2.5980762114;

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 w = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),w.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),w.x), w.y); }
float fbm(vec2 p){ return .57*noise(p) + .28*noise(p*2.03+13.1) + .15*noise(p*4.09+21.7); }

// 每个半径按开普勒角速度 ω = k / r^1.5 推进自己的相位。
vec4 diskAtTime(vec3 p, vec3 ray, float order, float flowTime){
  float r = length(p.xz);
  float inner = smoothstep(2.95,3.24,r);
  float outer = 1.0-smoothstep(8.0,14.5,r);
  float phase = atan(p.z,p.x) - flowTime*1.9/pow(max(r,3.0),1.5);
  vec2 orbit = vec2(cos(phase),sin(phase));
  float turbulence = fbm(orbit*3.7 + vec2(r*.45,r*.7));
  float fine = noise(orbit*13.0 + vec2(r*9.0,-r*5.0));
  // 宽窄不一的丝流：先扭曲半径坐标，再取多尺度密度，不出现等距的同心环
  float radialWarp = r + .20*noise(vec2(r*1.9,0.0)) + .09*turbulence;
  float broad = noise(vec2(radialWarp*5.1,0.0) + orbit*.28);
  float mid = noise(vec2(radialWarp*17.3,4.7) + orbit*.44);
  float thin = noise(vec2(radialWarp*48.0,11.3) + orbit*.7);
  float silk = noise(vec2(radialWarp*103.0,21.7) + orbit*.55);
  // 按导数过滤，掠射角和低分辨率下细丝不闪
  thin = mix(thin,.5,smoothstep(.3,1.1,fwidth(radialWarp)*48.0));
  silk = mix(silk,.5,smoothstep(.3,1.1,fwidth(radialWarp)*103.0));
  float density = (.08 + .85*pow(broad,1.8) + .7*pow(mid,2.0) + .35*thin + .14*silk) * (.52+.8*turbulence);
  float heat = pow(3.0/max(r,3.0),1.9) * inner * outer;
  float beta = .30 * sqrt(3.0/max(r,3.0));
  vec3 velocity = normalize(vec3(-p.z,0.0,p.x));
  float doppler = sqrt(1.0-beta*beta)/(1.0-beta*dot(velocity,-normalize(ray)));
  float radiance = heat * density * pow(doppler,3.0) * 6.7;
  vec3 warm = mix(vec3(.24,.095,.029), vec3(1.0,.76,.46), clamp(heat*2.0,0.0,1.0));
  warm = mix(warm,vec3(1.0,.955,.86),smoothstep(.55,1.3,radiance));
  float opacity = inner*outer*(1.0-exp(-density*(1.6 + heat*2.8)));
  vec3 material = warm*radiance + (fine-.5)*.009*outer*inner;
  return vec4(material, opacity*mix(1.0,.60,order));
}
// 无限推进会把丝流绕成亚像素噪声。两份有限年龄的流场交替，各自只在完全看不见时重置。
vec4 disk(vec3 p, vec3 ray, float order){
  float ageA = mod(uTime + 24.0,48.0) - 24.0;
  float ageB = mod(uTime,48.0) - 24.0;
  float blend = smoothstep(12.0,24.0,abs(ageA));
  vec4 a = diskAtTime(p,ray,order,ageA);
  if (blend <= 0.0) return a;
  vec4 b = diskAtTime(p,ray,order,ageB);
  float opacity = mix(a.a,b.a,blend);
  return vec4(mix(a.rgb*a.a,b.rgb*b.a,blend)/max(opacity,.00001), opacity);
}

// 镜头飞近（距离 < 30）时，沿同一条 R=30 的轨道往里接着走：
// 对 dφ/du 做 8 点 Gauss 积分，转动参考基即可复用同一张表（与应用相同）。
float orbitIntegrand(float u, float b2){ return inversesqrt(max(.000001, 1.0 - b2*u*u*(1.0-u))); }
float orbitOffset(float impact, float radius){
  float halfRange = (1.0/radius - 1.0/uLutR)*.5;
  float middle = (1.0/radius + 1.0/uLutR)*.5;
  float b2 = impact*impact;
  float sum = .1012285363*(orbitIntegrand(middle-halfRange*.9602898565,b2)+orbitIntegrand(middle+halfRange*.9602898565,b2));
  sum += .2223810345*(orbitIntegrand(middle-halfRange*.7966664774,b2)+orbitIntegrand(middle+halfRange*.7966664774,b2));
  sum += .3137066459*(orbitIntegrand(middle-halfRange*.5255324099,b2)+orbitIntegrand(middle+halfRange*.5255324099,b2));
  sum += .3626837834*(orbitIntegrand(middle-halfRange*.1834346425,b2)+orbitIntegrand(middle+halfRange*.1834346425,b2));
  return max(0.0, impact*halfRange*sum);
}

vec3 sky(vec3 d){
  vec3 col = vec3(.00045,.00055,.0008);
  d.xz = mat2(cos(uTime*.0032),sin(uTime*.0032),-sin(uTime*.0032),cos(uTime*.0032))*d.xz;
  vec2 sp = vec2(atan(d.z,d.x), asin(clamp(d.y,-1.0,1.0)))*70.0;
  vec2 cell = floor(sp), f = fract(sp)-.5;
  float star = step(.988,hash(cell+1.7))*exp(-dot(f,f)*60.0)*(.25+.75*hash(cell+9.1));
  return col + vec3(1.0,.94,.84)*star*.35*uStars;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y - uShift;
  float cr = cos(uRoll), sr = sin(uRoll);
  uv = mat2(cr,-sr,sr,cr)*uv;
  vec3 origin = uDist*vec3(cos(uIncl)*sin(uYaw), sin(uIncl), -cos(uIncl)*cos(uYaw));
  vec3 forward = -normalize(origin);
  vec3 right = normalize(cross(vec3(0,1,0),forward)), up = cross(forward,right);
  vec3 ray = normalize(forward + uFov*(uv.x*right + uv.y*up));

  // 光线所在平面：e1 指向镜头，e2 是光线垂直于 e1 的分量
  vec3 e1 = normalize(origin);
  vec3 tangentPart = ray - dot(ray,e1)*e1;
  vec3 e2 = length(tangentPart) > 1e-6 ? normalize(tangentPart) : up;
  float b = uDist*length(cross(e1,ray))/sqrt(1.0-1.0/uDist);
  float delta = b - BCRIT;
  float span = delta < 0.0 ? BCRIT : uMaxImpact - BCRIT;
  float q = sign(delta)*pow(abs(delta)/span,1.0/3.0);
  float lutX = ((q+1.0)*.5*(uLutSize.x-1.0)+.5)/uLutSize.x;
  vec4 terminal = texture(uTerm,vec2(lutX,.5));
  float phi0 = mod(atan(-e1.y,e2.y)+PI,PI);
  float observerPhi = 0.0;
  if (uDist < uLutR - .00001){
    float offset = orbitOffset(b, uDist);
    float c = cos(offset), sn = sin(offset);
    vec3 e1o = e1;
    e1 = e1o*c - e2*sn;
    e2 = e1o*sn + e2*c;
    phi0 += offset;
    observerPhi = offset;
  }

  vec3 color = vec3(0.0);
  float transmission = 1.0;
  // 前三次穿过盘面：主像和两次透镜像
  for (int i = 0; i < 3; i++){
    float phi = phi0 + float(i)*PI;
    if (phi >= terminal.r) break;
    if (phi <= observerPhi) continue;
    float lutY = (phi/uMaxPhi*(uLutSize.y-1.0)+.5)/uLutSize.y;
    float invR = texture(uGeo,vec2(lutX,lutY)).r;
    float r = 1.0/max(invR,.0001);
    if (r > 2.95 && r < 14.5){
      vec3 radial = e1*cos(phi) + e2*sin(phi);
      vec3 tangential = -e1*sin(phi) + e2*cos(phi);
      float row = 1.0/uLutSize.y;
      float w = (texture(uGeo,vec2(lutX,lutY+row)).r - texture(uGeo,vec2(lutX,lutY-row)).r)/(2.0*uMaxPhi/(uLutSize.y-1.0));
      vec3 localRay = normalize(-w/sqrt(max(.01,1.0-invR))*radial + invR*tangential);
      vec4 s = disk(radial*r, localRay, min(float(i),1.0));
      color += transmission*s.rgb*s.a;
      transmission *= 1.0 - s.a;
    }
  }
  // 视界轮廓保持几何：按临界冲击参数抗锯齿，不加噪声
  float horizonAA = max(length(vec2(dFdx(b),dFdy(b)))*.8, .00001);
  float swallowed = 1.0 - smoothstep(BCRIT-horizonAA, BCRIT+horizonAA, b);
  vec3 escaped = e1*cos(terminal.r) + e2*sin(terminal.r);
  color += transmission*mix(sky(normalize(escaped)), vec3(.00002), swallowed);

  // 光子环：临界冲击参数处一道亚像素细线和衰减的散射肩
  vec2 pImpact = uv*uFov*uDist;
  float theta = atan(pImpact.y,pImpact.x);
  float edge = abs(b - BCRIT);
  float ringWidth = max(fwidth(b)*.64, .0008);
  float ring = exp(-.5*pow(edge/ringWidth,2.0));
  float shoulder = exp(-edge*85.0)*.16;
  float ringGrain = .94 + .06*noise(vec2(cos(theta),sin(theta))*93.0);
  float side = mix(.65,1.6,smoothstep(-2.6,2.6,pImpact.x));
  color += vec3(1.0,.77,.52)*(ring*.25+shoulder)*ringGrain*side*transmission;

  // 照相式压缩：保留细的高温丝，不加泛光
  color *= uExpo;
  vec3 mapped = color/(1.0+color);
  vec3 c = pow(max(mapped,vec3(0.0)),vec3(.4545));
  c += (hash(gl_FragCoord.xy+vec2(7,13))-.5)/255.0;
  o = vec4(clamp(c,0.0,1.0),1.0);
}`;
