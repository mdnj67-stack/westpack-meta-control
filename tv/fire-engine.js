/*
 * Westpack TV - the wood stove.
 *
 * One WebGL2 renderer draws the inside of a Scandinavian wood stove seen through its glass door:
 * vermiculite firebox, birch logs, an ember bed, flames, sparks and smoke, plus the text of a KPI
 * that condenses out of the smoke and later burns away. Everything is procedural; there are no
 * image or video assets.
 *
 * Passes, per frame:
 *   1. scene    - firebox, logs, coals, flames, smoke (HDR, at a reduced resolution that adapts
 *                 to how fast the device is), then sparks as additive streaks.
 *   2. bloom    - dual-filter downsample/upsample chain over the scene.
 *   3. composite- scene + bloom, the KPI text at full resolution, the glass (soot, reflection),
 *                 the cast-iron frame with its embossed plate, tone mapping, grain and dither.
 *
 * Long-running on an office TV, so time never reaches the shaders as a growing float: every
 * scrolling noise layer gets a phase computed here in double precision and wrapped at the noise
 * lattice period (256), where the noise is exactly periodic. Without that, float precision
 * would visibly degrade the fire after a few hours.
 */
(function (global) {
  "use strict";

  const PERIOD = 256;

  // Lattice-units-per-second for each scrolling noise layer (see uPh in the shaders).
  const PHASE_RATES = [
    0.55, // 0 flame turbulence warp A
    0.68, // 1 flame turbulence warp B
    2.35, // 2 flame tongues (fast, upward)
    0.42, // 3 flame height variation
    1.60, // 4 heat haze
    0.10, // 5 coal breathing
    0.32, // 6 smoke warp
    0.46, // 7 log crack pulsing
    0.30, // 8 text formation drift
    0.22, // 9 text formation front
    1.10, // 10 text shimmer
    0.55, // 11 smoke tendrils
    0.147, // 12 where flame tongues stand (slow)
    0.256  // 13 smoke warp B
  ];

  // --------------------------------------------------------------------------------------------
  // GLSL

  const VERT_QUAD = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const GLSL_NOISE = `
uniform float uPh[14];

vec2 hash22(vec2 p) {
  p = mod(p, 256.0);
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash12(vec2 p) {
  p = mod(p, 256.0);
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Gradient noise, roughly [-1, 1], exactly periodic over 256 lattice cells.
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i) * 2.0 - 1.0, f);
  float b = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.65;
}

float fbm2(vec2 p) {
  return gnoise(p) * 0.66 + gnoise(p * 2.0 + vec2(19.1, 7.7)) * 0.34;
}

float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * gnoise(p); p = p * 2.0 + vec2(19.1, 7.7); a *= 0.5; }
  return s / 0.875;
}

float fbm4(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * gnoise(p); p = p * 2.0 + vec2(19.1, 7.7); a *= 0.5; }
  return s / 0.9375;
}

float fbm5(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * gnoise(p); p = p * 2.0 + vec2(19.1, 7.7); a *= 0.5; }
  return s / 0.96875;
}

// F1, F2 and a per-cell random value.
vec3 voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float f1 = 8.0, f2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; id = hash12(n + g + 7.0); }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}

// Temperature (0..~1.4) to emitted light, roughly a wood fire's black-body ramp. HDR.
vec3 fireRamp(float x) {
  vec3 c = vec3(0.0);
  c = mix(c, vec3(0.22, 0.018, 0.003), smoothstep(0.04, 0.24, x));
  c = mix(c, vec3(0.80, 0.15, 0.018), smoothstep(0.20, 0.48, x));
  c = mix(c, vec3(1.45, 0.52, 0.085), smoothstep(0.44, 0.78, x));
  c = mix(c, vec3(2.10, 1.10, 0.34), smoothstep(0.74, 1.08, x));
  c = mix(c, vec3(2.70, 1.95, 1.05), smoothstep(1.05, 1.40, x));
  return c;
}
`;

  const FRAG_SCENE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uAspect;
uniform float uLevel;      // fire size, 0 (embers) .. 1 (full) .. 1.2
uniform vec4 uFlick;       // three light flickers + global
uniform sampler2D uText;
uniform vec4 uTextBox;     // uv rect of the text texture
uniform vec4 uTS;          // x appear 0..1, y exit 0..1, z text present, w plume
${GLSL_NOISE}

const float BACK_X = 0.60;    // half-width of the back wall, in height units
const float FLOOR_Y = 0.118;  // where the back wall meets the floor
const float VP_Y = 0.56;      // vanishing point height

// Fire light reaching a point, warm. The three sources sit inside the flames.
vec3 fireLight(vec2 p) {
  vec2 d0 = (p - vec2(-0.27, 0.24)) * vec2(1.0, 0.85);
  vec2 d1 = (p - vec2(0.02, 0.29)) * vec2(1.0, 0.85);
  vec2 d2 = (p - vec2(0.30, 0.23)) * vec2(1.0, 0.85);
  float i = uFlick.x / (1.0 + 22.0 * dot(d0, d0))
          + uFlick.y * 1.15 / (1.0 + 19.0 * dot(d1, d1))
          + uFlick.z / (1.0 + 22.0 * dot(d2, d2));
  float lvl = 0.14 + 0.86 * uLevel;
  return vec3(1.0, 0.47, 0.17) * i * 0.34 * lvl;
}

// ---------------------------------------------------------------- firebox (walls and floor)
vec3 vermiculite(vec2 tc, float y, float x, float cleanBias) {
  float mott = fbm4(tc * vec2(7.0, 7.0));
  float grain = gnoise(tc * 64.0) * 0.5 + gnoise(tc * 150.0) * 0.5;
  vec3 clean = vec3(0.60, 0.52, 0.43) * (0.86 + 0.16 * mott + 0.07 * grain);
  // Soot: heavier the higher up, in blotches and faint vertical streaks; the area right behind
  // the flames burns clean.
  float streak = fbm3(vec2(tc.x * 16.0, tc.y * 1.4));
  float blot = fbm3(tc * vec2(2.6, 2.0) + vec2(3.0, 1.0));
  float s = smoothstep(0.24, 0.74, y + 0.20 * blot + 0.05 * streak - cleanBias);
  s = max(s, smoothstep(0.42, 0.95, abs(x) + 0.15 * blot));
  vec3 soot = vec3(0.034, 0.030, 0.027) * (0.8 + 0.4 * grain);
  return mix(clean, soot, clamp(s, 0.0, 1.0));
}

float seam(float d, float w) {
  return 1.0 - smoothstep(0.0, w, abs(d));
}

vec3 firebox(vec2 p) {
  float ax = abs(p.x);
  vec3 light = fireLight(p);
  vec3 col;

  float clean = 0.16 * exp(-pow(p.x / 0.42, 2.0));

  if (ax <= BACK_X) {
    // Back wall: three vertical panels and a horizontal joint behind the flames.
    vec3 alb = vermiculite(p, p.y, p.x * 0.8, clean);
    float sv = min(abs(p.x - 0.30), abs(p.x + 0.30));
    float sh = abs(p.y - 0.42 - 0.004 * sign(p.x));
    float joint = max(seam(sv, 0.0026), seam(sh, 0.0024));
    alb *= 1.0 - 0.45 * joint;
    // a hair of highlight on one side of each joint
    alb += vec3(0.035, 0.025, 0.015) * seam(sv - 0.0036, 0.0014) * (1.0 - smoothstep(0.45, 0.7, p.y));
    col = alb * (light + vec3(0.010, 0.008, 0.007));
  } else {
    // Side walls, in perspective towards the vanishing point.
    float zr = BACK_X / ax;
    float v = VP_Y + (p.y - VP_Y) * zr;
    float depth = (1.0 - zr) / (1.0 - BACK_X / (0.5 * uAspect));
    vec2 tc = vec2(depth * 0.55 + 2.0 * sign(p.x), v);
    vec3 alb = vermiculite(tc, v, BACK_X + depth * 0.3, clean * 0.5);
    float joint = max(seam(depth - 0.5, 0.0045 / zr), seam(v - 0.47, 0.0030));
    alb *= 1.0 - 0.7 * joint;
    // The side walls face the fire at an angle and fall off towards the glass.
    float facing = 0.62 - 0.30 * depth;
    col = alb * (light * facing + vec3(0.008, 0.006, 0.005));
    p.y = v; // floor test below works on the projected height
  }

  // Floor: ash on steel, below the back-floor line.
  float floorLine = FLOOR_Y;
  if (p.y < floorLine) {
    float ash = fbm3(vec2(p.x * 14.0, p.y * 40.0));
    vec3 alb = vec3(0.16, 0.15, 0.14) * (0.75 + 0.4 * ash);
    col = alb * fireLight(vec2(p.x, max(p.y, 0.1))) * 0.85;
  }
  return col;
}

// ---------------------------------------------------------------- ember bed
vec4 coals(vec2 p, float px) {
  float ax = abs(p.x);
  float top = 0.122 + 0.016 * gnoise(vec2(p.x * 7.0, 3.0)) - 0.05 * pow(ax / 0.62, 2.0);
  float cov = 1.0 - smoothstep(top - px, top + px, p.y);
  cov *= 1.0 - smoothstep(0.58, 0.68, ax);
  if (cov <= 0.0) return vec4(0.0);
  vec2 cq = vec2(p.x * 24.0, p.y * 62.0);
  vec3 vo = voronoi(cq);
  float edge = vo.y - vo.x;
  float interior = smoothstep(0.04, 0.42, edge);
  float breathe = 0.5 + 0.5 * gnoise(vec2(vo.z * 61.0, vo.z * 17.0) + vec2(0.0, uPh[5]));
  float heat = (0.34 + 0.58 * breathe) * (1.0 - smoothstep(0.25, 0.64, ax));
  heat *= (0.35 + 0.65 * uLevel) * (0.7 + 0.3 * uFlick.w);
  heat *= interior * (0.75 + 0.25 * vo.z);
  vec3 ash = vec3(0.09, 0.085, 0.08) * (1.0 - interior) * (0.4 + 0.6 * fireLight(p).r);
  vec3 c = fireRamp(heat * 0.92) * 0.85 + ash + vec3(0.012, 0.008, 0.006);
  return vec4(c, cov);
}

// ---------------------------------------------------------------- birch logs
// Rounded box in the log's own frame, so the ends read as sawn rather than as capsules.
// A real log is not a cylinder: its girth wanders a little along its length.
float logSdf(vec2 p, vec2 a, vec2 b, float r, out vec2 local, out float rr) {
  vec2 ba = b - a;
  float len = length(ba);
  vec2 dir = ba / len;
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 pa = p - a;
  local = vec2(dot(pa, dir), dot(pa, nrm));
  rr = r * (1.0 + 0.075 * gnoise(vec2(local.x * 7.0 + r * 211.0, 0.5)) + 0.03 * gnoise(vec2(local.x * 23.0, r * 97.0)));
  vec2 q = abs(vec2(local.x - len * 0.5, local.y)) - vec2(len * 0.5, rr) + rr * 0.42;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr * 0.42;
}

// The sawn end of a log that points a little towards the glass: growth rings, a pale face,
// a charred rim and radial checks, with the rim glowing where it sits in the fire.
vec4 logEnd(vec2 local, float len, float r, float rr, float side, float seed, float px, vec3 light) {
  float cx = side > 0.0 ? len - r * 0.18 : r * 0.18;
  vec2 e2 = vec2((local.x - cx) / (r * 0.52), local.y / rr);
  float e = length(e2);
  float cov = 1.0 - smoothstep(1.0 - px / (r * 0.52) * 1.5, 1.0, e);
  if (cov <= 0.0) return vec4(0.0);
  float ang = atan(e2.y, e2.x);
  float wob = gnoise(vec2(ang * 1.6 + seed, e * 3.0)) * 0.08;
  float rings = 0.5 + 0.5 * sin((e + wob) * 46.0);
  float checks = smoothstep(0.82, 0.95, gnoise(vec2(ang * 6.0 + seed * 3.0, 0.5)) * 0.5 + 0.5) * smoothstep(0.15, 0.6, e);
  vec3 wood = vec3(0.50, 0.37, 0.24) * (0.82 + 0.18 * rings);
  wood = mix(wood, vec3(0.08, 0.05, 0.03), checks * 0.8);
  float rim = smoothstep(0.74, 0.98, e + wob);
  wood = mix(wood, vec3(0.015, 0.012, 0.010), rim);
  vec3 c = wood * light * 1.05 + vec3(0.02, 0.012, 0.006);
  float hot = rim * (1.0 - smoothstep(0.96, 1.0, e)) * smoothstep(0.3, -0.6, e2.y);
  c += fireRamp(hot * 0.7 * (0.35 + 0.65 * uLevel)) * 0.5;
  return vec4(c, cov);
}

vec4 shadeLog(vec2 p, vec2 a, vec2 b, float r, float seed, float px, float endSide) {
  vec2 local;
  float rr;
  float d = logSdf(p, a, b, r, local, rr);
  float len = length(b - a);
  vec3 endLight = fireLight(p + vec2(0.0, 0.05));
  vec4 endFace = endSide != 0.0 ? logEnd(local, len, r, rr, endSide, seed, px, endLight) : vec4(0.0);
  float cov = 1.0 - smoothstep(-px, px, d);
  if (cov <= 0.0 && endFace.a <= 0.0) return vec4(0.0);
  float v = clamp(local.y / rr, -1.0, 1.0);          // -1 underside .. 1 top
  float theta = asin(v);
  float u = local.x;
  vec2 dir = (b - a) / len;
  vec2 nrm2 = vec2(-dir.y, dir.x);
  vec3 n = normalize(vec3(nrm2 * v, sqrt(max(0.0, 1.0 - v * v))));
  float endFade = smoothstep(0.0, r * 0.9, u) * smoothstep(0.0, r * 0.9, len - u);

  // How burnt: the underside and the middle of the fire first, the ends last.
  float centre = exp(-pow(p.x / 0.36, 2.0));
  float bn = fbm3(vec2(u * 6.0 + seed * 13.0, theta * 1.6 + seed));
  float burnRaw = 0.30 - v * 0.30 + centre * 0.32 + bn * 0.48 - (1.0 - endFade) * 0.55;
  float burnt = smoothstep(0.47, 0.53, burnRaw);

  // Birch bark: chalk white with dark horizontal lenticels and darker patches.
  float lent = smoothstep(0.42, 0.62, gnoise(vec2(u * 38.0 + seed * 7.0, theta * 1.1)));
  lent *= smoothstep(0.2, 0.6, gnoise(vec2(u * 9.0 + seed, theta * 6.0)) * 0.5 + 0.5);
  float barkPatch = smoothstep(0.30, 0.80, fbm3(vec2(u * 8.0 + seed * 3.0, theta * 1.8)));
  vec3 bark = vec3(0.66, 0.62, 0.56) * (0.9 + 0.1 * gnoise(vec2(u * 140.0, theta * 30.0)));
  bark = mix(bark, vec3(0.06, 0.05, 0.045), lent * 0.9);
  bark = mix(bark, vec3(0.16, 0.13, 0.11), barkPatch * 0.6);
  // sawn ends show pale wood with a charred rim
  float endZone = 1.0 - smoothstep(0.0, r * 0.35, min(u, len - u));
  bark = mix(bark, vec3(0.52, 0.40, 0.27), endZone * 0.7);

  // Char: small crocodile cells; the cracks glow on the underside, where the coals and the
  // flames below keep it hot, and the top goes to grey ash.
  vec3 vo = voronoi(vec2(u * 40.0 + seed * 11.0, theta * r * 40.0 * 1.35) + vec2(gnoise(vec2(u * 9.0, theta)) * 0.35, 0.0));
  float crack = 1.0 - smoothstep(0.02, 0.085, vo.y - vo.x);
  float pulse = 0.5 + 0.5 * gnoise(vec2(u * 4.0 + seed * 9.0, vo.z * 3.0) + vec2(0.0, uPh[7]));
  float under = smoothstep(0.35, -0.85, v);
  float heat = burnt * (0.10 + 0.90 * under) * (0.35 + 0.65 * centre) * (0.45 + 0.55 * pulse) * (0.3 + 0.7 * uLevel);
  float ashTop = smoothstep(-0.1, 0.9, v) * smoothstep(0.35, 0.95, vo.z) * (1.0 - crack);
  vec3 charCol = vec3(0.012, 0.010, 0.009) + vec3(0.075, 0.072, 0.068) * ashTop;

  // The flames are mostly above and behind the logs, so the faces towards us are in their own
  // shadow and the top edges catch the light. Roundness comes from darkening towards the edges.
  vec3 light = fireLight(p + vec2(0.0, 0.08));
  float topLit = max(0.0, dot(n, normalize(vec3(0.0, 0.95, 0.3))));
  float roundness = pow(max(n.z, 0.0), 0.7);
  float diff = (0.05 + 0.62 * topLit) * (0.30 + 0.70 * roundness);
  float rim = pow(1.0 - n.z, 3.0) * smoothstep(0.25, 0.95, v);
  vec3 baseCol = mix(bark, charCol, burnt);
  vec3 c = baseCol * light * diff + vec3(1.0, 0.40, 0.10) * rim * 0.28 * uFlick.w * (0.3 + 0.7 * uLevel);
  // emission: glowing cracks, a dull red bloom under the char, and the burning bark edge
  c += fireRamp(heat * crack * 1.05) * 0.6;
  c += fireRamp(heat * 0.5) * 0.07 * burnt * under;
  float edge = exp(-pow((burnRaw - 0.50) / 0.011, 2.0)) * endFade * (0.3 + 0.7 * under);
  c += vec3(1.25, 0.36, 0.06) * edge * (0.25 + 0.75 * uLevel) * (0.6 + 0.4 * pulse);
  c = mix(c, endFace.rgb, endFace.a);
  return vec4(c, max(cov, endFace.a));
}

// Height of the fuel (top of the log pile) at x. Flames start here.
float logTop(float x, vec2 a, vec2 b, float r) {
  float t = clamp((x - a.x) / (b.x - a.x), 0.0, 1.0);
  float inside = smoothstep(a.x - 0.03, a.x + 0.16, x) * (1.0 - smoothstep(b.x - 0.16, b.x + 0.03, x));
  float y = mix(a.y, b.y, t) + r * 0.92;
  return mix(0.10, y, inside);
}

float smax(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}

// The logs: two at the bottom, one across on top.
const vec2 LA0 = vec2(-0.56, 0.104); const vec2 LA1 = vec2(0.08, 0.122); const float LAR = 0.052;
const vec2 LB0 = vec2(-0.04, 0.118); const vec2 LB1 = vec2(0.58, 0.096); const float LBR = 0.056;
const vec2 LC0 = vec2(-0.36, 0.158); const vec2 LC1 = vec2(0.40, 0.214); const float LCR = 0.048;

float fuelTop(float x) {
  float s = 0.122 - 0.05 * pow(abs(x) / 0.62, 2.0);
  s = smax(s, logTop(x, LA0, LA1, LAR), 0.03);
  s = smax(s, logTop(x, LB0, LB1, LBR), 0.03);
  s = smax(s, logTop(x, LC0, LC1, LCR), 0.03);
  return s;
}

// ---------------------------------------------------------------- flames
vec3 flames(vec2 p, out float dens) {
  float S = fuelTop(p.x);
  float h = p.y - S;
  float lvl = uLevel;
  float env = exp(-pow(abs(p.x) / (0.46 + 0.04 * lvl), 3.0));

  // turbulence that bends the tongues as they rise
  vec2 q = p * vec2(2.4, 1.7);
  vec2 w = vec2(fbm3(q + vec2(0.0, -uPh[0])), fbm3(q + vec2(7.3, -uPh[1])));
  float bend = clamp(h / 0.25, 0.0, 1.5);
  float xs = p.x + w.x * 0.075 * bend;

  // where along the logs a tongue stands; slowly wandering
  float src = fbm2(vec2(xs * 3.4, uPh[12])) * 0.5 + 0.5;
  src = smoothstep(0.22, 0.66, src);

  vec2 qq = vec2(xs * 7.2, p.y * 2.7) + w * vec2(0.45, 0.85);
  float n = fbm5(qq + vec2(0.0, -uPh[2])) * 0.5 + 0.5;

  float hv = fbm2(vec2(xs * 2.6, -uPh[3])) * 0.5 + 0.5;
  float hmax = (0.09 + 0.28 * src * (0.55 + 0.45 * hv)) * (0.15 + 0.85 * lvl) * env + 0.012;
  hmax *= 0.82 + 0.36 * exp(-p.x * p.x / 0.07);
  float t = h / hmax;
  float d = (1.0 - t) * (0.66 + 0.55 * src) + (n - 0.5) * 2.1 - 0.06;
  d *= smoothstep(-0.006, 0.032, h);
  d *= smoothstep(0.0, 0.35, env);
  dens = clamp(d, 0.0, 1.5);
  float temp = dens * (1.02 - 0.45 * clamp(t, 0.0, 1.0)) * (0.84 + 0.16 * uFlick.w);
  vec3 c = fireRamp(temp);
  // a little blue right at the root of the flames, as wood fires have
  float blue = smoothstep(0.03, 0.0, h) * smoothstep(-0.015, 0.0, h) * smoothstep(0.25, 0.7, dens);
  c += vec3(0.05, 0.12, 0.55) * blue * 0.6;
  return c;
}

// ---------------------------------------------------------------- smoke
float textMask(vec2 uv, float lod) {
  vec2 tuv = (uv - uTextBox.xy) / (uTextBox.zw - uTextBox.xy);
  if (tuv.x < -0.1 || tuv.x > 1.1 || tuv.y < -0.2 || tuv.y > 1.1) return 0.0;
  return textureLod(uText, tuv, lod).a;
}

void main() {
  vec2 uv = vUv;
  vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y);
  float px = 1.25 / uRes.y;

  // Heat haze over and above the flames shifts what is seen behind them.
  float hz = smoothstep(0.14, 0.32, p.y) * (1.0 - smoothstep(0.5, 0.85, p.y)) * exp(-pow(p.x / 0.55, 2.0));
  vec2 haze = vec2(gnoise(p * vec2(10.0, 7.0) + vec2(0.0, -uPh[4])),
                   gnoise(p * vec2(10.0, 7.0) + vec2(4.7, -uPh[4]))) * 0.0032 * hz * (0.3 + 0.7 * uLevel);
  vec2 pb = p + haze;

  vec3 col = firebox(pb);

  vec4 cb = coals(p, px);
  col = mix(col, cb.rgb, cb.a);

  float fd;
  vec3 fl = flames(p, fd);

  // Back logs first, then the one across the top, which shades them where it rests on them.
  vec2 lcLocal;
  float rrC;
  float dC = logSdf(p, LC0, LC1, LCR, lcLocal, rrC);
  float contact = 0.30 + 0.70 * smoothstep(0.0, 0.055, dC);
  vec4 la = shadeLog(p, LA0, LA1, LAR, 1.3, px, -1.0);
  col = mix(col, la.rgb * contact, la.a);
  vec4 lb = shadeLog(p, LB0, LB1, LBR, 4.1, px, 1.0);
  col = mix(col, lb.rgb * contact, lb.a);
  vec4 lc = shadeLog(p, LC0, LC1, LCR, 7.7, px, 1.0);
  col = mix(col, lc.rgb, lc.a);

  col += fl;

  // Smoke: thin tendrils rising out of the flames, lit from below.
  vec2 sq = vec2(p.x * 2.1, p.y * 1.25);
  vec2 sw = vec2(fbm3(sq + vec2(0.0, -uPh[6])), fbm3(sq + vec2(5.1, -uPh[13])));
  float sn = fbm4(vec2(p.x * 3.4, p.y * 1.6) + sw * 1.1 + vec2(0.0, -uPh[11])) * 0.5 + 0.5;
  float ridge = 1.0 - abs(sn * 2.0 - 1.0);
  float tendril = pow(ridge, 5.0);
  float plumeW = 0.10 + p.y * 0.30;
  float plume = exp(-pow(p.x / plumeW, 2.0)) * smoothstep(0.26, 0.48, p.y) * (1.0 - smoothstep(0.75, 1.05, p.y));
  float smoke = tendril * plume * (0.16 + 0.10 * uLevel);

  // Smoke that becomes the text, and the text that goes back to smoke.
  float pA = uTS.x, qE = uTS.y;
  if (uTS.z > 0.5) {
    float bell = smoothstep(0.0, 0.35, pA) * (1.0 - smoothstep(0.6, 1.0, pA));
    float ia = 1.0 - pA;
    // The text's own shape, torn up by turbulence and drawn up from below, so it reads as
    // smoke gathering into letters rather than as blurred type.
    vec2 tq = vec2(p.x * 6.0, p.y * 4.0);
    vec2 wv = vec2(fbm3(tq + vec2(0.0, -uPh[8] * 2.0)), fbm3(tq + vec2(3.3, -uPh[8] * 2.0)));
    float wisp = 0.25 + 0.75 * smoothstep(0.35, 0.85, sn);
    vec2 off = wv * (0.010 + 0.05 * ia) + vec2(0.0, 0.10 * ia * ia);
    float m = textMask(uv + off, 2.2 + 2.2 * ia);
    smoke += m * bell * 1.05 * wisp;
    // the column of smoke that carries the text up from the fire
    float colW = 0.16 + p.y * 0.18;
    smoke += bell * tendril * exp(-pow(p.x / colW, 2.0)) * smoothstep(0.25, 0.45, p.y) * 0.45 * (1.0 - smoothstep(0.7, 0.95, p.y));

    if (qE > 0.0) {
      vec2 tuv = (uv - uTextBox.xy) / (uTextBox.zw - uTextBox.xy);
      float F = qE * 1.5 - 0.25;
      float rise = clamp(F - tuv.y, 0.0, 0.6);
      vec2 src = uv - vec2(0.0, 0.10 * rise) + wv * (0.010 + 0.10 * rise);
      float m2 = textMask(src, 2.0 + rise * 6.0);
      smoke += m2 * smoothstep(0.0, 0.04, rise) * exp(-rise * 6.0) * 1.35 * (1.0 - qE * 0.5) * wisp;
    }
  }
  smoke = clamp(smoke, 0.0, 1.0);
  vec3 smokeLit = vec3(0.30, 0.25, 0.21) * (0.35 + fireLight(p).r * 1.1) + vec3(0.02);
  col = mix(col, smokeLit, smoke * 0.55) + smokeLit * smoke * 0.18;

  fragColor = vec4(col, 1.0);
}`;

  const VERT_SPARK = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPosVel;
layout(location = 2) in vec2 aSizeTemp;
uniform vec2 uRes;
uniform float uAspect;
out vec2 vC;
out float vTemp;
void main() {
  vec2 vel = aPosVel.zw;
  float sp = length(vel);
  vec2 dir = sp > 1e-5 ? vel / sp : vec2(0.0, 1.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = aSizeTemp.x / uRes.y;
  float len = w + sp * 0.022;
  vec2 pos = aPosVel.xy + dir * aCorner.y * len + nrm * aCorner.x * w;
  gl_Position = vec4(pos.x / uAspect * 2.0, pos.y * 2.0 - 1.0, 0.0, 1.0);
  vC = aCorner;
  vTemp = aSizeTemp.y;
}`;

  const FRAG_SPARK = `#version 300 es
precision highp float;
in vec2 vC;
in float vTemp;
out vec4 fragColor;
void main() {
  float r = length(vec2(vC.x, vC.y * 0.85));
  float a = exp(-r * r * 3.2);
  float t = clamp(vTemp, 0.0, 1.0);
  vec3 c = mix(vec3(0.55, 0.06, 0.0), vec3(2.4, 0.95, 0.22), smoothstep(0.0, 0.55, t));
  c = mix(c, vec3(4.0, 2.8, 1.4), smoothstep(0.6, 1.0, t));
  fragColor = vec4(c * a * (0.25 + 0.75 * t), 1.0);
}`;

  const FRAG_DOWN = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold;
void main() {
  vec2 o = uTexel * 0.5;
  vec3 c = texture(uSrc, vUv).rgb * 4.0;
  c += texture(uSrc, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture(uSrc, vUv + vec2( o.x, -o.y)).rgb;
  c += texture(uSrc, vUv + vec2(-o.x,  o.y)).rgb;
  c += texture(uSrc, vUv + vec2( o.x,  o.y)).rgb;
  c /= 8.0;
  if (uThreshold > 0.0) {
    float l = max(c.r, max(c.g, c.b));
    float k = smoothstep(uThreshold, uThreshold * 2.2, l);
    c *= k;
  }
  fragColor = vec4(c, 1.0);
}`;

  const FRAG_UP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;
void main() {
  vec2 o = uTexel * 0.5;
  vec3 c = texture(uSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  c += texture(uSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(0.0, o.y * 2.0)).rgb;
  c += texture(uSrc, vUv + vec2(o.x, o.y)).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  c += texture(uSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  c += texture(uSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  c += texture(uSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  fragColor = vec4(c / 12.0, 1.0);
}`;

  const FRAG_COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uText;
uniform sampler2D uPlate;
uniform vec2 uRes;
uniform float uAspect;
uniform vec4 uTextBox;
uniform vec4 uTS;
uniform vec4 uFlick;
uniform float uLevel;
uniform vec4 uInset;       // left, right, top, bottom (uv)
uniform float uRadius;     // in height units
uniform vec4 uPlateBox;    // uv rect of the bottom plate texture
uniform vec2 uPlateTexel;
uniform float uSeed;
uniform float uExposure;
uniform vec2 uShift;       // slow orbit against burn-in on OLED panels
${GLSL_NOISE}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 uv = vUv + uShift;
  vec2 P = vec2(uv.x * uAspect, uv.y);
  float pxs = 1.0 / uRes.y;

  // The glass opening.
  float gx0 = uInset.x * uAspect, gx1 = uAspect * (1.0 - uInset.y);
  float gy0 = uInset.w, gy1 = 1.0 - uInset.z;
  vec2 gc = vec2(gx0 + gx1, gy0 + gy1) * 0.5;
  vec2 gh = vec2(gx1 - gx0, gy1 - gy0) * 0.5;
  float d = sdRoundBox(P - gc, gh, uRadius);

  vec3 hdr = texture(uScene, uv).rgb + texture(uBloom, uv).rgb * 0.55;

  // ---------------------------------------------------------- the KPI text
  vec3 textCol = vec3(0.0);
  float textA = 0.0;
  float emberGlow = 0.0;
  if (uTS.z > 0.5) {
    vec2 tuv = (uv - uTextBox.xy) / (uTextBox.zw - uTextBox.xy);
    // the blurred lookups clamp at the texture's edge, so fade them out before it
    float win = smoothstep(-0.04, 0.03, tuv.x) * (1.0 - smoothstep(0.97, 1.04, tuv.x))
              * smoothstep(-0.06, 0.04, tuv.y) * (1.0 - smoothstep(0.96, 1.04, tuv.y));
    if (win > 0.0) {
      float pA = uTS.x, qE = uTS.y;
      float ia = 1.0 - pA;
      float na = fbm3(tuv * vec2(7.0, 3.5) + vec2(0.0, -uPh[8]));
      vec2 disp = vec2(na * 0.035 * ia * ia, -0.085 * ia * ia * ia);
      float shimAmt = 0.35 + 0.65 * smoothstep(0.45, 0.0, tuv.y);
      vec2 shim = vec2(gnoise(tuv * vec2(34.0, 13.0) + vec2(0.0, -uPh[10])),
                       gnoise(tuv * vec2(34.0, 13.0) + vec2(5.3, -uPh[10]))) * 0.0005 * shimAmt;
      // exit: what is about to burn lifts and stretches a little
      float F = qE * 1.5 - 0.25;
      float nb = fbm3(tuv * vec2(15.0, 7.0) + vec2(11.0, 3.0)) * 0.5 + 0.5;
      float nb2 = fbm3(tuv * vec2(4.0, 2.0) + vec2(2.0, 9.0)) * 0.5 + 0.5;
      float front = tuv.y + (nb - 0.5) * 0.18 + (nb2 - 0.5) * 0.30 - F;   // > 0: not burnt yet
      vec2 lift = vec2(0.0, -0.012 * smoothstep(0.12, 0.0, front) * step(0.0001, qE));
      vec2 suv = tuv + disp + shim + lift;
      vec4 tx = textureLod(uText, suv, 0.0);
      float a = tx.a;

      // formation: condenses from the bottom up out of the smoke
      float nf = fbm3(tuv * vec2(9.0, 5.0) + vec2(3.1, -uPh[9])) * 0.5 + 0.5;
      float formT = pA * 1.5 - 0.22 - tuv.y * 0.3;
      float form = smoothstep(nf * 0.55 - 0.07, nf * 0.55 + 0.07, formT);

      float alive = smoothstep(-0.004, 0.008, front);
      if (qE <= 0.0) alive = 1.0;
      float charring = (1.0 - smoothstep(0.0, 0.045, front)) * step(0.0001, qE);
      float ember = exp(-pow(front / 0.013, 2.0)) * step(0.0001, qE);

      vec3 cream = toLinear(vec3(1.0, 0.945, 0.865));
      vec3 amber = toLinear(vec3(0.98, 0.72, 0.40));
      vec3 base = mix(cream, amber, tx.r) * mix(1.0, 0.80, tx.b);
      vec3 smokeC = toLinear(vec3(0.62, 0.56, 0.52));
      vec3 tc = mix(smokeC, base, smoothstep(0.45, 1.0, pA));
      tc = mix(tc, toLinear(vec3(0.20, 0.09, 0.035)), charring * 0.9);
      tc = mix(tc, toLinear(vec3(1.0, 0.62, 0.22)), ember * 0.85);
      emberGlow = ember * smoothstep(0.1, 0.6, a) * win;

      float solid = mix(0.42, 1.0, smoothstep(0.5, 1.0, pA));
      textA = clamp(a * form * alive * solid, 0.0, 1.0);
      textCol = tc;

      // warm halo, so the text reads as lit by the fire and holds against bright flames
      float halo = (textureLod(uText, suv, 3.5).a * 0.6 + textureLod(uText, suv, 5.0).a * 0.4) * win;
      // shade the scene behind the letters a touch, for contrast, then a warm halo
      hdr *= 1.0 - 0.45 * textureLod(uText, suv, 3.0).a * win * form * alive * smoothstep(0.4, 1.0, pA);
      hdr += vec3(1.0, 0.50, 0.18) * halo * 0.10 * form * alive * smoothstep(0.3, 1.0, pA);
      // the burning edge
      hdr += vec3(3.4, 1.15, 0.22) * ember * smoothstep(0.1, 0.6, a) * 1.6;
    }
  }

  vec3 col = aces(hdr * uExposure);
  col = mix(col, textCol, textA);
  col += vec3(1.0, 0.36, 0.06) * emberGlow * 0.55;

  // ---------------------------------------------------------- the glass
  float inside = -d;
  // soot creeping in from the edges, mostly the bottom corners
  float sn = fbm4(P * vec2(9.0, 9.0) + vec2(13.0, 2.0)) * 0.5 + 0.5;
  float cornerB = exp(-pow((P.y - gy0) / 0.16, 2.0)) * smoothstep(gh.x * 0.25, gh.x * 1.05, abs(P.x - gc.x));
  float edgeSoot = exp(-inside / 0.022) * 0.85;
  float soot = clamp(edgeSoot * (0.55 + 0.6 * sn) + cornerB * smoothstep(0.35, 0.8, sn) * 0.95, 0.0, 1.0);
  vec3 sootTint = toLinear(vec3(0.11, 0.085, 0.065));
  vec3 glassed = mix(col, col * 0.18 + sootTint * 0.05, soot * 0.82);
  // faint reflection of the room in the glass
  float band = exp(-pow((P.x - P.y * 0.9 - gc.x + 0.45) / 0.25, 2.0));
  float band2 = exp(-pow((P.x - P.y * 0.9 - gc.x - 0.55) / 0.08, 2.0));
  glassed += toLinear(vec3(0.62, 0.70, 0.80)) * (band * 0.010 + band2 * 0.006 + 0.004);
  // a thin bright line where the glass meets the frame
  glassed += vec3(1.0, 0.55, 0.22) * exp(-pow((inside - 0.0025) / 0.0012, 2.0)) * 0.05 * (0.4 + 0.6 * uFlick.w);

  // ---------------------------------------------------------- the cast-iron frame
  vec2 gp = vec2(clamp(P.x, gx0, gx1), clamp(P.y, gy0, gy1));
  vec2 eps = vec2(0.0015, 0.0);
  vec2 grad = normalize(vec2(sdRoundBox(P + eps.xy - gc, gh, uRadius) - sdRoundBox(P - eps.xy - gc, gh, uRadius),
                             sdRoundBox(P + eps.yx - gc, gh, uRadius) - sdRoundBox(P - eps.yx - gc, gh, uRadius)) + 1e-6);
  vec2 fireP = vec2(gc.x, gy0 + 0.25);
  float fireDist = length(P - fireP);
  float fireI = (0.55 + 0.45 * uFlick.w) * (0.25 + 0.75 * uLevel);
  float ironGrain = gnoise(P * 380.0) * 0.5 + gnoise(P * 150.0) * 0.5;
  vec3 iron = vec3(0.0085, 0.0080, 0.0076) * (0.8 + 0.35 * ironGrain);
  // inner chamfer facing the opening catches the fire, most where it is nearest
  float cw = 0.009;
  float ch = smoothstep(0.0, 0.0015, d) * (1.0 - smoothstep(cw - 0.002, cw, d));
  float towardFire = 0.5 + 0.5 * dot(-grad, normalize(fireP - P));
  float near = 1.0 / (1.0 + 9.0 * fireDist * fireDist);
  float chLight = ch * towardFire * fireI * 0.32 * near;
  iron += vec3(0.95, 0.42, 0.15) * chLight;
  iron += vec3(0.95, 0.50, 0.22) * exp(-pow((d - cw) / 0.0011, 2.0)) * fireI * 0.035 * near;
  // the flat face shows a soft warm sheen near the opening
  iron += vec3(0.65, 0.30, 0.11) * exp(-max(d - cw, 0.0) / 0.03) * fireI * 0.02 * near * (1.0 - ch);

  // the plate on the bottom bar: raised lettering lit from the fire above it
  vec2 puv = (uv - uPlateBox.xy) / (uPlateBox.zw - uPlateBox.xy);
  if (puv.x > 0.0 && puv.x < 1.0 && puv.y > 0.0 && puv.y < 1.0) {
    float h0 = textureLod(uPlate, puv, 0.0).a;
    float hb = textureLod(uPlate, puv, 1.2).a;
    float hx = textureLod(uPlate, puv + vec2(uPlateTexel.x * 1.5, 0.0), 1.2).a - textureLod(uPlate, puv - vec2(uPlateTexel.x * 1.5, 0.0), 1.2).a;
    float hy = textureLod(uPlate, puv + vec2(0.0, uPlateTexel.y * 1.5), 1.2).a - textureLod(uPlate, puv - vec2(0.0, uPlateTexel.y * 1.5), 1.2).a;
    vec3 n = normalize(vec3(-hx * 2.4, -hy * 2.4, 1.0));
    float li = max(0.0, dot(n, normalize(vec3((fireP.x - P.x) * 0.6, 0.9, 0.45))));
    float top = max(0.0, -n.y) ;
    vec3 face = vec3(0.040, 0.036, 0.033) + vec3(0.85, 0.42, 0.16) * fireI * 0.055 * li;
    vec3 edgeLit = vec3(0.9, 0.45, 0.18) * fireI * 0.22 * pow(max(0.0, n.y), 1.4) * hb;
    float shadow = smoothstep(0.0, 0.6, top) * 0.5;
    vec3 emb = mix(iron * (1.0 - shadow * (1.0 - h0)), face, h0 * 0.85) + edgeLit;
    iron = mix(iron, emb, clamp(hb * 1.6, 0.0, 1.0));
  }

  float frameMask = smoothstep(-pxs, pxs, d);
  col = mix(glassed, iron, frameMask);

  // ---------------------------------------------------------- finish
  vec2 vq = uv - 0.5;
  float vig = 1.0 - 0.38 * pow(length(vq * vec2(1.0, 1.25)) * 1.25, 2.2);
  col *= clamp(vig, 0.0, 1.0);
  // grain and dither, so the dark gradients do not band on a TV panel
  float g = hash12(gl_FragCoord.xy + vec2(uSeed * 61.0, uSeed * 37.0)) - 0.5;
  float g2 = hash12(gl_FragCoord.xy * 1.7 + vec2(uSeed * 13.0, 5.0)) - 0.5;
  col += (g * 0.022 + g2 * 0.010) * (0.25 + sqrt(max(col, vec3(0.0))));
  col = max(col, 0.0);
  vec3 srgb = pow(col, vec3(1.0 / 2.2));
  srgb += (hash12(gl_FragCoord.xy + 3.7) - 0.5) / 255.0;
  fragColor = vec4(srgb, 1.0);
}`;

  // --------------------------------------------------------------------------------------------
  // Small JS noise for flicker (double precision, never wraps).

  function hash1(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function noise1(x) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash1(i) * (1 - u) + hash1(i + 1) * u;
  }

  function flick(t, seed) {
    return 0.72
      + 0.22 * noise1(t * 1.35 + seed * 17.0)
      + 0.10 * noise1(t * 4.1 + seed * 5.0)
      + 0.05 * noise1(t * 11.0 + seed * 3.0);
  }

  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // --------------------------------------------------------------------------------------------

  class FireplaceEngine {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.options = options;
      const gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer),
        powerPreference: "high-performance"
      });
      if (!gl) throw new Error("WebGL2 is not available.");
      this.gl = gl;
      this.floatOk = Boolean(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
      gl.getExtension("OES_texture_float_linear");

      this.sceneScale = options.sceneScale || 0.62;
      this.maxSceneScale = options.maxSceneScale || 0.8;
      this.minSceneScale = 0.38;
      this.level = options.level == null ? 1 : options.level;
      this.levelTarget = this.level;
      this.inset = options.inset || { left: 0.032, right: 0.032, top: 0.045, bottom: 0.082 };
      this.textBox = options.textBox || [0.06, 0.37, 0.94, 0.90];
      this.time = 0;
      this.lastNow = 0;
      this.textState = null;
      this.shift = [0, 0];
      this.frameTimes = [];
      this.running = false;
      this.onFrame = null;

      this.programs = {
        scene: this.program(VERT_QUAD, FRAG_SCENE),
        spark: this.program(VERT_SPARK, FRAG_SPARK),
        down: this.program(VERT_QUAD, FRAG_DOWN),
        up: this.program(VERT_QUAD, FRAG_UP),
        composite: this.program(VERT_QUAD, FRAG_COMPOSITE)
      };

      this.quad = this.createQuad();
      this.initSparks(options.maxSparks || 520);
      this.textTex = this.createTexture(1, 1, null, true);
      this.plateTex = this.createTexture(1, 1, null, true);
      this.plateSize = [1, 1];
      this.hasText = false;
      this.targets = null;
      this.resize();

      this.handleResize = () => this.resize();
      global.addEventListener("resize", this.handleResize);
    }

    // ------------------------------------------------------------------ GL plumbing
    shader(type, source) {
      const gl = this.gl;
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(`Shader compile failed: ${log}`);
      }
      return s;
    }

    program(vs, fs) {
      const gl = this.gl;
      const p = gl.createProgram();
      gl.attachShader(p, this.shader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, this.shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
      }
      const uniforms = {};
      const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(p, i);
        const name = info.name.replace(/\[0\]$/, "");
        uniforms[name] = gl.getUniformLocation(p, info.name);
      }
      return { p, u: uniforms };
    }

    createQuad() {
      const gl = this.gl;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      return vao;
    }

    createTexture(w, h, data, mipmap) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }

    createTarget(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (this.floatOk) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok && this.floatOk) {
        this.floatOk = false;
        gl.deleteTexture(tex);
        gl.deleteFramebuffer(fb);
        return this.createTarget(w, h);
      }
      return { tex, fb, w, h };
    }

    destroyTargets() {
      if (!this.targets) return;
      const gl = this.gl;
      const all = [this.targets.scene, ...this.targets.down, ...this.targets.up];
      for (const t of all) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fb);
      }
      this.targets = null;
    }

    resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      let w = Math.round(this.canvas.clientWidth * dpr) || 1920;
      let h = Math.round(this.canvas.clientHeight * dpr) || 1080;
      const maxW = this.options.maxWidth || 2560;
      if (w > maxW) {
        h = Math.round(h * maxW / w);
        w = maxW;
      }
      this.canvas.width = w;
      this.canvas.height = h;
      this.width = w;
      this.height = h;
      this.aspect = w / h;
      this.buildTargets();
    }

    buildTargets() {
      this.destroyTargets();
      const sw = Math.max(64, Math.round(this.width * this.sceneScale));
      const sh = Math.max(36, Math.round(this.height * this.sceneScale));
      const scene = this.createTarget(sw, sh);
      const down = [];
      let w = sw, h = sh;
      for (let i = 0; i < 5; i++) {
        w = Math.max(2, Math.round(w / 2));
        h = Math.max(2, Math.round(h / 2));
        down.push(this.createTarget(w, h));
      }
      const up = [];
      for (let i = down.length - 2; i >= 0; i--) {
        up.push(this.createTarget(down[i].w, down[i].h));
      }
      this.targets = { scene, down, up };
    }

    // ------------------------------------------------------------------ sparks
    initSparks(max) {
      const gl = this.gl;
      this.sparkMax = max;
      this.sparks = [];
      this.sparkData = new Float32Array(max * 6);
      this.sparkVao = gl.createVertexArray();
      gl.bindVertexArray(this.sparkVao);
      const corner = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, corner);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.sparkBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sparkBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.sparkData.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 0);
      gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
      gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null);
      this.nextPop = 3 + Math.random() * 5;
    }

    spawnSpark(x, y, vx, vy, life, size, temp) {
      if (this.sparks.length >= this.sparkMax) return;
      this.sparks.push({ x, y, vx, vy, life, age: 0, size, temp0: temp, seed: Math.random() * 100 });
    }

    // A crackle: a knot in a log pops and throws a handful of sparks.
    pop(x, y, count) {
      const n = count || (10 + Math.floor(Math.random() * 22));
      for (let i = 0; i < n; i++) {
        const a = Math.PI * 0.5 + gauss() * 0.55;
        const s = 0.25 + Math.random() * 0.55;
        this.spawnSpark(x + gauss() * 0.01, y + Math.random() * 0.01, Math.cos(a) * s, Math.sin(a) * s,
          0.7 + Math.random() * 1.6, 1.4 + Math.random() * 2.2, 0.9 + Math.random() * 0.1);
      }
    }

    updateSparks(dt) {
      const lvl = this.level;
      // steady drift of embers out of the fire
      this.sparkAcc = (this.sparkAcc || 0) + dt * (4 + 22 * lvl);
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        const x = gauss() * 0.17;
        if (Math.abs(x) > 0.5) continue;
        this.spawnSpark(x, 0.20 + Math.random() * 0.14 * (0.4 + lvl), gauss() * 0.03, 0.10 + Math.random() * 0.22,
          1.6 + Math.random() * 2.6, 1.0 + Math.random() * 1.8, 0.65 + Math.random() * 0.35);
      }
      this.nextPop -= dt;
      if (this.nextPop <= 0) {
        this.nextPop = 4 + Math.random() * 9;
        if (lvl > 0.2) {
          this.pop(gauss() * 0.2, 0.17 + Math.random() * 0.08);
          this.popFlash = 1;
        }
      }
      // sparks off the burning edge of the text
      const ts = this.textState;
      if (ts && ts.glyphs && ts.glyphs.length && this.textQ > 0 && this.textQ < 1) {
        const F = this.textQ * 1.5 - 0.25;
        const box = this.textBox;
        const rate = dt * 160;
        for (let i = 0; i < rate; i++) {
          const g = ts.glyphs[(Math.random() * ts.glyphs.length) | 0];
          if (Math.abs(g[1] - F) > 0.035) continue;
          const sx = (box[0] + g[0] * (box[2] - box[0]) - 0.5) * this.aspect;
          const sy = box[1] + g[1] * (box[3] - box[1]);
          this.spawnSpark(sx, sy, gauss() * 0.04, 0.06 + Math.random() * 0.18,
            0.6 + Math.random() * 1.3, 0.9 + Math.random() * 1.5, 0.75 + Math.random() * 0.25);
        }
      }
      const t = this.time;
      const alive = [];
      for (const s of this.sparks) {
        s.age += dt;
        if (s.age >= s.life) continue;
        const k = s.age / s.life;
        // turbulence: a smooth, changing flow field
        const fx = (noise1(s.y * 6 + t * 0.7 + s.seed) - 0.5) * 0.9 + (noise1(s.x * 9 + t * 1.3) - 0.5) * 0.4;
        const fy = (noise1(s.x * 5 + t * 0.6 + s.seed * 0.3) - 0.5) * 0.4;
        s.vx += fx * dt;
        s.vy += (fy + 0.05 * (1 - k)) * dt;
        const drag = Math.exp(-dt * 0.9);
        s.vx *= drag;
        s.vy *= drag;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y > 1.08 || Math.abs(s.x) > this.aspect * 0.5 + 0.05) continue;
        s.temp = s.temp0 * Math.pow(1 - k, 1.3) * (0.85 + 0.15 * noise1(t * 9 + s.seed));
        alive.push(s);
      }
      this.sparks = alive;
    }

    // ------------------------------------------------------------------ text
    /**
     * Show a KPI. `canvas` holds the text (alpha = coverage, red = amber accent, blue = dimmed),
     * laid out over `this.textBox`. `glyphs` are points on the letters, in text uv, used to
     * throw sparks off the burning edge. Returns a promise that resolves once it has burnt away.
     */
    showText(canvas, glyphs, timing = {}) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.textTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      this.hasText = true;
      return new Promise((resolve) => {
        this.textState = {
          start: this.time,
          appear: timing.appear || 3.4,
          hold: timing.hold || 12,
          exit: timing.exit || 3.0,
          glyphs,
          resolve
        };
      });
    }

    /** Ends the current text now (it burns away) - used when the data changes underneath. */
    burnNow() {
      const ts = this.textState;
      if (!ts) return;
      const elapsed = this.time - ts.start;
      if (elapsed < ts.appear + ts.hold) ts.hold = Math.max(0, elapsed - ts.appear);
    }

    updateText() {
      const ts = this.textState;
      if (!ts) {
        this.textP = 0;
        this.textQ = 0;
        return;
      }
      const e = this.time - ts.start;
      this.textP = Math.min(1, Math.max(0, e / ts.appear));
      this.textQ = Math.min(1, Math.max(0, (e - ts.appear - ts.hold) / ts.exit));
      if (e >= ts.appear + ts.hold + ts.exit) {
        this.textState = null;
        this.hasText = false;
        this.textP = 0;
        this.textQ = 0;
        ts.resolve();
      }
    }

    setPlate(canvas) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.plateTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      this.plateSize = [canvas.width, canvas.height];
    }

    plateBox() {
      const i = this.inset;
      return [i.left + 0.012, 0.010, 1 - i.right - 0.012, i.bottom - 0.010];
    }

    setLevel(level) {
      this.levelTarget = Math.max(0, Math.min(1.2, level));
    }

    /** Resolves after `seconds` of fire time, so pauses stop when the tab is hidden. */
    wait(seconds) {
      return new Promise((resolve) => {
        this.waiters = this.waiters || [];
        this.waiters.push({ at: this.time + seconds, resolve });
      });
    }

    runWaiters() {
      if (!this.waiters || !this.waiters.length) return;
      const due = this.waiters.filter((w) => w.at <= this.time);
      if (!due.length) return;
      this.waiters = this.waiters.filter((w) => w.at > this.time);
      due.forEach((w) => w.resolve());
    }

    // ------------------------------------------------------------------ frame
    phases() {
      const t = this.time;
      return PHASE_RATES.map((rate) => (t * rate) % PERIOD);
    }

    step(dt) {
      this.time += dt;
      const k = 1 - Math.exp(-dt * 0.35);
      this.level += (this.levelTarget - this.level) * k;
      this.popFlash = Math.max(0, (this.popFlash || 0) - dt * 3);
      this.updateText();
      this.updateSparks(dt);
      this.runWaiters();
      // slow orbit of the whole picture, a few pixels, against burn-in on OLED panels
      const o = this.time / 600;
      this.shift = [Math.cos(o) * 0.0016, Math.sin(o * 1.3) * 0.0022];
    }

    render() {
      const gl = this.gl;
      const T = this.targets;
      const t = this.time;
      const ph = this.phases();
      const g = flick(t, 0.0) + (this.popFlash || 0) * 0.25;
      const flicks = [flick(t, 1.0), flick(t, 2.0), flick(t, 3.0), g];
      const ts = [this.textP || 0, this.textQ || 0, this.hasText ? 1 : 0, 0];

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);

      // 1. scene
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.scene.fb);
      gl.viewport(0, 0, T.scene.w, T.scene.h);
      let pr = this.programs.scene;
      gl.useProgram(pr.p);
      gl.uniform2f(pr.u.uRes, T.scene.w, T.scene.h);
      gl.uniform1f(pr.u.uAspect, this.aspect);
      gl.uniform1f(pr.u.uLevel, this.level);
      gl.uniform4fv(pr.u.uFlick, flicks);
      gl.uniform1fv(pr.u.uPh, ph);
      gl.uniform4fv(pr.u.uTextBox, this.textBox);
      gl.uniform4fv(pr.u.uTS, ts);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.textTex);
      gl.uniform1i(pr.u.uText, 0);
      gl.bindVertexArray(this.quad);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // sparks, additive
      const n = this.sparks.length;
      if (n) {
        const data = this.sparkData;
        const scale = T.scene.h / 1080;
        for (let i = 0; i < n; i++) {
          const s = this.sparks[i];
          const o = i * 6;
          data[o] = s.x;
          data[o + 1] = s.y;
          data[o + 2] = s.vx;
          data[o + 3] = s.vy;
          data[o + 4] = Math.max(0.9, s.size * scale * 1.4);
          data[o + 5] = s.temp;
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        pr = this.programs.spark;
        gl.useProgram(pr.p);
        gl.uniform2f(pr.u.uRes, T.scene.w, T.scene.h);
        gl.uniform1f(pr.u.uAspect, this.aspect);
        gl.bindVertexArray(this.sparkVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sparkBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 6);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
        gl.disable(gl.BLEND);
      }

      // 2. bloom
      gl.bindVertexArray(this.quad);
      pr = this.programs.down;
      gl.useProgram(pr.p);
      let src = T.scene;
      T.down.forEach((dst, i) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        gl.viewport(0, 0, dst.w, dst.h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(pr.u.uSrc, 0);
        gl.uniform2f(pr.u.uTexel, 1 / src.w, 1 / src.h);
        gl.uniform1f(pr.u.uThreshold, i === 0 ? 0.55 : 0.0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        src = dst;
      });
      pr = this.programs.up;
      gl.useProgram(pr.p);
      T.up.forEach((dst) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        gl.viewport(0, 0, dst.w, dst.h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(pr.u.uSrc, 0);
        gl.uniform2f(pr.u.uTexel, 1 / src.w, 1 / src.h);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        src = dst;
      });
      const bloom = src;

      // 3. composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      pr = this.programs.composite;
      gl.useProgram(pr.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, T.scene.tex);
      gl.uniform1i(pr.u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bloom.tex);
      gl.uniform1i(pr.u.uBloom, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.textTex);
      gl.uniform1i(pr.u.uText, 2);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.plateTex);
      gl.uniform1i(pr.u.uPlate, 3);
      gl.uniform2f(pr.u.uRes, this.width, this.height);
      gl.uniform1f(pr.u.uAspect, this.aspect);
      gl.uniform4fv(pr.u.uTextBox, this.textBox);
      gl.uniform4fv(pr.u.uTS, ts);
      gl.uniform4fv(pr.u.uFlick, flicks);
      gl.uniform1fv(pr.u.uPh, ph);
      gl.uniform1f(pr.u.uLevel, this.level);
      const i = this.inset;
      gl.uniform4f(pr.u.uInset, i.left, i.right, i.top, i.bottom);
      gl.uniform1f(pr.u.uRadius, 0.018);
      gl.uniform4fv(pr.u.uPlateBox, this.plateBox());
      gl.uniform2f(pr.u.uPlateTexel, 1 / this.plateSize[0], 1 / this.plateSize[1]);
      gl.uniform1f(pr.u.uSeed, (t * 60) % 97);
      gl.uniform1f(pr.u.uExposure, this.options.exposure || 1.0);
      gl.uniform2fv(pr.u.uShift, this.shift);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    }

    // Adapt the scene resolution to the device: a TV stick is not a desktop GPU.
    adapt(frameMs) {
      if (this.options.fixedScale) return;
      this.frameTimes.push(frameMs);
      if (this.frameTimes.length < 90) return;
      const sorted = this.frameTimes.slice().sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      this.frameTimes = [];
      let next = this.sceneScale;
      if (median > 24 && this.sceneScale > this.minSceneScale) next = Math.max(this.minSceneScale, this.sceneScale * 0.85);
      else if (median < 13 && this.sceneScale < this.maxSceneScale) next = Math.min(this.maxSceneScale, this.sceneScale * 1.08);
      if (Math.abs(next - this.sceneScale) > 0.01) {
        this.sceneScale = next;
        this.buildTargets();
      }
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastNow = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dtMs = Math.min(100, now - this.lastNow);
        this.lastNow = now;
        this.step(dtMs / 1000);
        this.render();
        this.adapt(dtMs);
        if (this.onFrame) this.onFrame(dtMs);
        this.raf = global.requestAnimationFrame(loop);
      };
      this.raf = global.requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
      if (this.raf) global.cancelAnimationFrame(this.raf);
    }

    /** Render one deterministic-enough frame at time `t` (for screenshots and checks). */
    still(t, text) {
      this.stop();
      this.sparks = [];
      this.time = Math.max(0, t - 6);
      const dt = 1 / 60;
      while (this.time < t) this.step(dt);
      if (text) {
        this.textP = text.p;
        this.textQ = text.q;
        this.hasText = true;
      }
      this.render();
    }
  }

  global.FireplaceEngine = FireplaceEngine;
})(window);
