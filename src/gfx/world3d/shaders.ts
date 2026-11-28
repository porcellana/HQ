/** Shaders GLSL ES 3.00 del mundo 3D. */
const MAXL = 10;


/**
 * Niebla de exploración: textura de visibilidad de 1 texel por casilla (R = explorado,
 * G = visible ahora, B = visible antes; se mezcla con uVisP.w para animar el despeje).
 * Lo desconocido se cubre de bruma oscura con aspecto de nube; lo recordado se atenúa.
 */
export const FOG_GLSL = `
uniform sampler2D uVis; uniform vec4 uVisP; uniform vec2 uVisT;
float fgH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fgN(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(fgH(i), fgH(i+vec2(1,0)), f.x), mix(fgH(i+vec2(0,1)), fgH(i+vec2(1,1)), f.x), f.y);
}
float fgF(vec2 p){ return fgN(p)*0.55 + fgN(p*2.1+3.7)*0.3 + fgN(p*4.3+9.1)*0.15; }
// x = cobertura de bruma (1 = desconocido), y = atenuación de memoria
vec2 fogAt(vec2 q){
  float t = uVisT.x;
  float n1 = fgF(q*0.30 + vec2(t*0.045, t*0.03));
  float n2 = fgF(q*0.65 + vec2(-t*0.03, t*0.05) + 7.0);
  vec2 uv = (q + (vec2(n1, n2) - 0.5) * 1.6) * uVisP.xy;
  vec3 v = texture(uVis, uv).rgb;
  float lit = mix(v.b, v.g, uVisP.w);
  float known = max(v.r, lit);
  float cover = 1.0 - smoothstep(0.2, 0.8, known);
  float mem = smoothstep(0.2, 0.8, known) * (1.0 - smoothstep(0.25, 0.85, lit));
  return vec2(cover, mem);
}
vec4 fogApply(vec3 col, vec3 wp, vec3 fogCol){
  if (uVisP.z < 0.5) return vec4(col, 0.0);
  vec2 f = fogAt(wp.xz);
  float n = fgF(wp.xz * 0.5 + vec2(uVisT.x * 0.06, -uVisT.x * 0.04));
  vec3 mist = mix(vec3(0.055, 0.07, 0.105), fogCol * 0.55 + 0.05, smoothstep(0.3, 0.85, n));
  col = mix(col, col * vec3(0.5, 0.56, 0.68) + mist * 0.18, f.y * 0.85);
  col = mix(col, mist, clamp(f.x * 1.04, 0.0, 1.0));
  return vec4(col, f.x);
}`;

export const WORLD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
layout(location=3) in float aSway;
layout(location=4) in vec4 aI0;
layout(location=5) in vec4 aI1;
uniform mat4 uVP;
uniform mat4 uModel;
uniform float uTime;
uniform float uWind;
out vec3 vCol; out vec3 vNrm; out vec3 vWorld; out float vEmis;
void main(){
  float emis = step(1.5, aSway);
  float win = step(2.5, aSway);
  float sway = emis > 0.5 ? 0.0 : aSway;
  vec4 w = uModel * vec4(aPos, 1.0);
  vec3 n = mat3(uModel) * aNrm;
  float c = cos(aI0.w), s = sin(aI0.w);
  vec3 ip = vec3(w.x*c + w.z*s, w.y, -w.x*s + w.z*c) * aI1.x + aI0.xyz;
  n = vec3(n.x*c + n.z*s, n.y, -n.x*s + n.z*c);
  float ph = uTime*1.7 + ip.x*0.9 + ip.z*0.7;
  ip.x += sin(ph) * sway * 0.075 * uWind + sin(ph*2.3) * sway * 0.015 * uWind;
  ip.z += cos(ph*0.8) * sway * 0.045 * uWind;
  vWorld = ip; vNrm = normalize(n); vCol = aCol * aI1.yzw; vEmis = emis + win;
  gl_Position = uVP * vec4(ip, 1.0);
}`;

export const WORLD_FS = `#version 300 es
precision highp float;
in vec3 vCol; in vec3 vNrm; in vec3 vWorld; in float vEmis;
uniform vec3 uCam; uniform vec3 uFogCol; uniform float uFogDen; uniform float uFogOff;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmbTop; uniform vec3 uAmbBot;
uniform vec4 uFlash;
uniform float uDis; uniform float uDisY; uniform vec3 uDisCol; uniform float uWin;
uniform vec4 uL[${MAXL}]; uniform vec3 uLC[${MAXL}]; uniform int uNL;
uniform highp sampler2DShadow uSh; uniform mat4 uShVP; uniform vec4 uShP;
${FOG_GLSL}
out vec4 o;
// Sombra del mapa de sombras con PCF suave (5 toques con filtro bilineal por hardware).
float shadowAt(vec3 wp, vec3 n){
  if (uShP.x <= 0.0) return 1.0;
  vec4 s = uShVP * vec4(wp + n * 0.07, 1.0);
  vec3 q = s.xyz * 0.5 + 0.5;
  if (q.z > 1.0 || q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 1.0;
  float t = uShP.y, z = q.z - uShP.z;
  float v = texture(uSh, vec3(q.xy, z)) * 0.28;
  v += texture(uSh, vec3(q.xy + vec2(t, t) * 1.2, z)) * 0.18;
  v += texture(uSh, vec3(q.xy + vec2(-t, t) * 1.2, z)) * 0.18;
  v += texture(uSh, vec3(q.xy + vec2(t, -t) * 1.2, z)) * 0.18;
  v += texture(uSh, vec3(q.xy + vec2(-t, -t) * 1.2, z)) * 0.18;
  float e = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
  return mix(1.0, v, uShP.x * smoothstep(0.0, 0.12, e));
}
void main(){
  float edge = 0.0;
  if (uDis > 0.0) {
    float nn = 0.5 + 0.25 * sin(vWorld.x * 9.0 + vWorld.y * 5.0) * sin(vWorld.z * 8.0 + 1.7) + 0.25 * sin(vWorld.y * 11.0 + vWorld.x * 4.0 + vWorld.z * 3.0);
    float hh = clamp((vWorld.y - uDisY) / 1.6, 0.0, 1.0);
    float thr = uDis * 1.5 - (1.0 - hh) * 0.55;
    if (nn < thr) discard;
    edge = 1.0 - smoothstep(0.0, 0.1, nn - thr);
  }
  vec3 n = normalize(vNrm);
  vec3 V = normalize(uCam - vWorld);
  vec3 amb = mix(uAmbBot, uAmbTop, n.y * 0.5 + 0.5);
  // Luz envolvente suave (media lambert) con rampa blanda: volumen sin cantos duros.
  float wrap = clamp((dot(n, normalize(uSunDir)) + 0.45) / 1.45, 0.0, 1.0);
  float d = wrap * wrap * (3.0 - 2.0 * wrap);
  float sh = shadowAt(vWorld, n);
  vec3 lit = amb * (0.84 + 0.16 * sh) + uSunCol * d * 0.82 * sh;
  // Contraluz suave en los bordes (aspecto de cuento).
  float rim = pow(1.0 - max(dot(n, V), 0.0), 2.6);
  lit += (uAmbTop * 0.55 + uSunCol * 0.2) * rim * 0.26;
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= uNL) break;
    vec3 dv = uL[i].xyz - vWorld; float dist = length(dv);
    float a = clamp(1.0 - dist / uL[i].w, 0.0, 1.0);
    lit += uLC[i] * a * a * (0.55 + 0.45 * max(dot(n, dv / max(dist, 0.001)), 0.0));
  }
  vec3 col = vCol * lit;
  if (vEmis > 0.5) col = vCol * 1.25;
  if (vEmis > 1.5) {
    // Ventana: cristal oscuro de día, luz cálida de noche.
    vec3 glass = vec3(0.36, 0.5, 0.62) * (amb * 0.8 + uSunCol * 0.25);
    col = mix(glass, vCol * 1.5, uWin);
  }
  col = mix(col, uFlash.rgb, uFlash.a);
  col = mix(col, uDisCol * 1.7, edge);
  float dc = max(distance(vWorld, uCam) - uFogOff, 0.0);
  float f = 1.0 - exp(-pow(dc * uFogDen, 2.0));
  col = mix(col, uFogCol, clamp(f, 0.0, 1.0));
  col = fogApply(col, vWorld, uFogCol).rgb;
  // Tono suave (contraste y saturación ligeras).
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 1.14);
  col = col / (1.0 + col * 0.12) * 1.1;
  o = vec4(col, 1.0);
}`;

export const WATER_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=2) in vec3 aCol;
layout(location=3) in float aSway;
uniform mat4 uVP; uniform float uTime;
out vec3 vCol; out vec3 vWorld; out float vDeep;
void main(){
  vec3 p = aPos;
  p.y += sin(p.x*1.7 + uTime*1.3) * 0.025 * aSway + cos(p.z*1.3 + uTime*1.1) * 0.02 * aSway;
  vWorld = p; vCol = aCol; vDeep = aSway;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const WATER_FS = `#version 300 es
precision highp float;
in vec3 vCol; in vec3 vWorld; in float vDeep;
uniform vec3 uCam; uniform vec3 uFogCol; uniform float uFogDen; uniform float uFogOff; uniform float uTime;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uAmbTop;
uniform vec4 uL[${MAXL}]; uniform vec3 uLC[${MAXL}]; uniform int uNL;
${FOG_GLSL}
out vec4 o;
void main(){
  vec2 p = vWorld.xz;
  float t = uTime;
  vec3 n = normalize(vec3(
    cos(p.x*2.3 + t*1.2)*0.11 + cos(p.y*3.1 - p.x*1.1 + t*0.9)*0.08,
    1.0,
    sin(p.y*2.1 + t*1.0)*0.11 + sin(p.x*2.7 + p.y*1.3 - t*1.1)*0.08));
  vec3 V = normalize(uCam - vWorld);
  float fres = pow(1.0 - max(dot(V, n), 0.0), 3.0);
  vec3 shallow = vCol * 1.35 + vec3(0.05, 0.1, 0.08);
  vec3 deep = vCol * 0.55;
  vec3 col = mix(shallow, deep, smoothstep(0.0, 1.0, vDeep));
  col = col * (uAmbTop * 0.55 + 0.45) + uSunCol * 0.1;
  col = mix(col, uSky, fres * 0.55);
  vec3 H = normalize(normalize(uSunDir) + V);
  float spec = pow(max(dot(n, H), 0.0), 260.0);
  col += uSunCol * spec * 0.45;
  float sp = sin(p.x*9.0 + t*2.0) * sin(p.y*8.0 - t*1.7);
  col += vec3(0.5, 0.65, 0.7) * smoothstep(0.9, 1.0, sp) * 0.12 * uSunCol;
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= uNL) break;
    float dist = distance(uL[i].xyz, vWorld);
    float a = clamp(1.0 - dist / uL[i].w, 0.0, 1.0);
    col += uLC[i] * a * a * 0.6 * (0.7 + 0.3 * sin(p.x*7.0 + t*2.0));
  }
  float foam = (1.0 - smoothstep(0.0, 0.2, vDeep)) * (0.55 + 0.45 * sin(t*2.2 + p.x*4.0 + p.y*3.0));
  float foam2 = smoothstep(0.55, 0.9, sin(p.x*5.0 + t) * sin(p.y*5.0 + t*0.8)) * (1.0 - smoothstep(0.0, 0.5, vDeep));
  col = mix(col, vec3(0.92, 0.97, 1.0) * (0.5 + 0.5 * length(uAmbTop)), clamp(foam * 0.6 + foam2 * 0.1, 0.0, 1.0));
  float dc = max(distance(vWorld, uCam) - uFogOff, 0.0);
  float f = clamp(1.0 - exp(-pow(dc * uFogDen, 2.0)), 0.0, 1.0);
  col = mix(col, uFogCol, f);
  float alpha = mix(0.6, 0.93, smoothstep(0.0, 0.6, vDeep)) + foam * 0.2;
  vec4 fg = fogApply(col, vWorld, uFogCol);
  o = vec4(fg.rgb, clamp(mix(alpha, 1.0, fg.a), 0.0, 1.0));
}`;

export const BLOB_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=3) in float aSway;
uniform mat4 uVP; uniform mat4 uModel;
out float vA;
void main(){ vA = aSway; gl_Position = uVP * (uModel * vec4(aPos, 1.0)); }`;
export const BLOB_FS = `#version 300 es
precision mediump float;
in float vA; uniform float uAlpha; uniform vec3 uTint; out vec4 o;
void main(){ o = vec4(uTint, vA * uAlpha); }`;

export const PART_VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 aSeed;
uniform mat4 uVP; uniform vec3 uCenter; uniform float uTime; uniform vec3 uVel; uniform float uSize; uniform float uScale; uniform float uGround; uniform float uBox; uniform float uBoxH;
out float vTw;
void main(){
  vec3 s = aSeed.xyz;
  vec3 p;
  p.x = mod(s.x * uBox + uVel.x * uTime + sin(uTime*0.6 + aSeed.w*40.0) * 0.8 - (uCenter.x - uBox*0.5), uBox) + (uCenter.x - uBox*0.5);
  p.z = mod(s.z * uBox + uVel.z * uTime + cos(uTime*0.5 + aSeed.w*30.0) * 0.8 - (uCenter.z - uBox*0.5), uBox) + (uCenter.z - uBox*0.5);
  p.y = uGround + mod(s.y * uBoxH + uVel.y * uTime, uBoxH) + 0.1;
  vTw = 0.55 + 0.45 * sin(uTime * 2.0 + aSeed.w * 60.0);
  vec4 c = uVP * vec4(p, 1.0);
  gl_Position = c;
  gl_PointSize = clamp(uSize * uScale * (0.6 + aSeed.w) / max(c.w, 0.5), 1.5, 70.0);
}`;
export const PART_FS = `#version 300 es
precision mediump float;
in float vTw; uniform vec4 uColor; out vec4 o;
void main(){
  vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, r)) * uColor.a * vTw;
  o = vec4(uColor.rgb, a);
}`;
export const MAX_LIGHTS = MAXL;

/** Pasada de profundidad del mapa de sombras (usa WORLD_VS). */
export const SHADOW_FS = `#version 300 es
precision mediump float;
in vec3 vCol; in vec3 vNrm; in vec3 vWorld; in float vEmis;
out vec4 o;
void main(){ o = vec4(0.0); }`;

export const SKY_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.9999, 1.0);
}`;
export const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform mat4 uInv; uniform vec3 uEye; uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uFog; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform float uTime; uniform float uStars; uniform float uFlat; uniform vec4 uMoon; uniform vec4 uWarm; uniform float uBias;
out vec4 o;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
void main(){
  if (uFlat > 0.5) { o = vec4(uFog, 1.0); return; }
  vec4 w = uInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = w.xyz / w.w - uEye;
  dir = normalize(dir + vec3(0.0, uBias * length(dir), 0.0));
  float y = dir.y;
  vec3 col = mix(uHor, uTop, smoothstep(0.0, 0.75, y));
  col = mix(uFog, col, smoothstep(-0.08, 0.1, y));
  float sd = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.14 + pow(sd, 90.0) * 0.55);
  if (y > 0.02) {
    vec2 uv = dir.xz / (y + 0.35) * 1.3 + vec2(uTime * 0.012, 0.0);
    float c = vn(uv * 1.7) * 0.55 + vn(uv * 3.9) * 0.3 + vn(uv * 8.1) * 0.15;
    float cl = smoothstep(0.52, 0.8, c) * smoothstep(0.02, 0.25, y);
    vec3 cc = mix(uHor, vec3(1.0), 0.7) * (0.65 + 0.35 * length(uSunCol));
    cc = mix(cc, cc * vec3(0.16, 0.2, 0.34) + uHor * 0.2, clamp(uStars * 1.4, 0.0, 1.0));
    cc += uWarm.rgb * uWarm.w * 0.35;
    col = mix(col, cc, cl * 0.55);
    vec2 g = dir.xz / (y + 0.2) * 70.0;
    vec2 sc = floor(g);
    float hs = h2(sc);
    vec2 off = (vec2(h2(sc + 1.7), h2(sc + 4.1)) - 0.5) * 0.5;
    float d = length(fract(g) - 0.5 - off);
    float st = step(0.93, hs) * smoothstep(0.2, 0.0, d) * (0.55 + 0.45 * sin(uTime * (2.0 + hs * 3.0) + hs * 90.0));
    col += mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.9, 0.75), fract(hs * 77.0)) * st * uStars * smoothstep(0.02, 0.3, y);
  }
  // Resplandor cálido de amanecer y atardecer pegado al horizonte, hacia el sol.
  col += uWarm.rgb * uWarm.w * exp(-abs(y) * 6.5) * (0.3 + 0.7 * pow(sd, 3.0));
  // Luna: disco con manchas, halo suave.
  if (uMoon.w > 0.001) {
    float md = max(dot(dir, normalize(uMoon.xyz)), 0.0);
    float tight = step(0.01, uBias);
    float disc = smoothstep(mix(0.99925, 0.99996, tight), mix(0.99955, 0.999985, tight), md);
    float maria = 0.82 + 0.18 * sin(dir.x * 380.0) * sin(dir.z * 330.0 + dir.y * 120.0);
    float haze = pow(md, mix(40.0, 600.0, tight)) * 0.32 + pow(md, mix(7.0, 60.0, tight)) * 0.07;
    col += vec3(0.86, 0.9, 1.0) * (disc * 1.5 * maria + haze) * uMoon.w * smoothstep(-0.05, 0.12, y);
  }
  o = vec4(col, 1.0);
}`;

export const SPR_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aSizeA;
layout(location=2) in vec3 aCol;
uniform mat4 uVP; uniform float uScale;
out vec3 vC; out float vA;
void main(){
  vec4 c = uVP * vec4(aPos, 1.0);
  gl_Position = c;
  gl_PointSize = clamp(aSizeA.x * uScale / max(c.w, 0.3), 2.0, 420.0);
  vC = aCol; vA = aSizeA.y;
}`;
export const SPR_FS = `#version 300 es
precision mediump float;
in vec3 vC; in float vA; out vec4 o;
void main(){
  vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
  float a = pow(max(1.0 - r, 0.0), 1.7) * vA;
  float core = pow(max(1.0 - r, 0.0), 6.0);
  o = vec4(vC + core * 0.6, a);
}`;

/** Láminas de bruma que flotan sobre lo desconocido (volumen barato: dos capas con parallax). */
export const MIST_VS = `#version 300 es
precision highp float;
uniform mat4 uVP; uniform vec3 uCenter; uniform float uSize;
out vec3 vWorld;
void main(){
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  vec3 p = vec3(uCenter.x + c.x * uSize, uCenter.y, uCenter.z + c.y * uSize);
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const MIST_FS = `#version 300 es
precision highp float;
in vec3 vWorld; uniform vec3 uFogCol; uniform float uLayer;
${FOG_GLSL}
out vec4 o;
void main(){
  vec2 f = fogAt(vWorld.xz);
  float t = uVisT.x;
  float n = fgF(vWorld.xz * (0.42 + uLayer * 0.1) + vec2(t * (0.07 + uLayer * 0.03), -t * 0.05) + uLayer * 11.0);
  float puff = smoothstep(0.38, 0.8, n);
  float a = f.x * puff * (0.5 - uLayer * 0.08);
  vec3 col = mix(vec3(0.08, 0.1, 0.15), uFogCol * 0.6 + 0.06, 0.35 + 0.5 * n);
  o = vec4(col, a);
}`;

/** Posproceso: triángulo a pantalla completa; umbral de brillo, desenfoque separable y composición. */
export const POST_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
export const BRIGHT_FS = `#version 300 es
precision mediump float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTh; out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uTh.x, uTh.x + uTh.y, l);
  o = vec4(c * k, 1.0);
}`;
export const BLUR_FS = `#version 300 es
precision mediump float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){
  vec3 c = texture(uTex, vUv).rgb * 0.2270;
  c += (texture(uTex, vUv + uDir * 1.3846).rgb + texture(uTex, vUv - uDir * 1.3846).rgb) * 0.3162;
  c += (texture(uTex, vUv + uDir * 3.2308).rgb + texture(uTex, vUv - uDir * 3.2308).rgb) * 0.0703;
  o = vec4(c, 1.0);
}`;
export const COMPOSE_FS = `#version 300 es
precision mediump float;
in vec2 vUv; uniform sampler2D uScene; uniform sampler2D uBloom; uniform vec2 uK; out vec4 o;
void main(){
  vec3 s = texture(uScene, vUv).rgb;
  vec3 b = texture(uBloom, vUv).rgb * uK.x;
  vec3 c = s + b - s * b * 0.6;
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * uK.y;
  o = vec4(c, 1.0);
}`;
