/** Shaders GLSL ES 3.00 del mundo 3D. */
const MAXL = 10;

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
  float sway = emis > 0.5 ? 0.0 : aSway;
  vec4 w = uModel * vec4(aPos, 1.0);
  vec3 n = mat3(uModel) * aNrm;
  float c = cos(aI0.w), s = sin(aI0.w);
  vec3 ip = vec3(w.x*c + w.z*s, w.y, -w.x*s + w.z*c) * aI1.x + aI0.xyz;
  n = vec3(n.x*c + n.z*s, n.y, -n.x*s + n.z*c);
  float ph = uTime*1.7 + ip.x*0.9 + ip.z*0.7;
  ip.x += sin(ph) * sway * 0.075 * uWind + sin(ph*2.3) * sway * 0.015 * uWind;
  ip.z += cos(ph*0.8) * sway * 0.045 * uWind;
  vWorld = ip; vNrm = normalize(n); vCol = aCol * aI1.yzw; vEmis = emis;
  gl_Position = uVP * vec4(ip, 1.0);
}`;

export const WORLD_FS = `#version 300 es
precision highp float;
in vec3 vCol; in vec3 vNrm; in vec3 vWorld; in float vEmis;
uniform vec3 uCam; uniform vec3 uFogCol; uniform float uFogDen; uniform float uFogOff;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmbTop; uniform vec3 uAmbBot;
uniform vec4 uFlash;
uniform float uDis; uniform float uDisY; uniform vec3 uDisCol;
uniform vec4 uL[${MAXL}]; uniform vec3 uLC[${MAXL}]; uniform int uNL;
out vec4 o;
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
  vec3 lit = amb * 0.95 + uSunCol * d * 0.82;
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
  col = mix(col, uFlash.rgb, uFlash.a);
  col = mix(col, uDisCol * 1.7, edge);
  float dc = max(distance(vWorld, uCam) - uFogOff, 0.0);
  float f = 1.0 - exp(-pow(dc * uFogDen, 2.0));
  col = mix(col, uFogCol, clamp(f, 0.0, 1.0));
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
  o = vec4(col, clamp(alpha, 0.0, 1.0));
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
in float vA; uniform float uAlpha; out vec4 o;
void main(){ o = vec4(0.02, 0.03, 0.05, vA * uAlpha); }`;

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
  gl_PointSize = clamp(uSize * uScale * (0.6 + aSeed.w) / max(c.w, 0.5), 1.5, 22.0);
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
uniform float uTime; uniform float uStars; uniform float uFlat;
out vec4 o;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
void main(){
  if (uFlat > 0.5) { o = vec4(uFog, 1.0); return; }
  vec4 w = uInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(w.xyz / w.w - uEye);
  float y = dir.y;
  vec3 col = mix(uHor, uTop, smoothstep(0.0, 0.75, y));
  col = mix(uFog, col, smoothstep(-0.08, 0.1, y));
  float sd = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.14 + pow(sd, 90.0) * 0.55);
  if (y > 0.02) {
    vec2 uv = dir.xz / (y + 0.35) * 1.3 + vec2(uTime * 0.012, 0.0);
    float c = vn(uv * 1.7) * 0.55 + vn(uv * 3.9) * 0.3 + vn(uv * 8.1) * 0.15;
    float cl = smoothstep(0.52, 0.8, c) * smoothstep(0.02, 0.25, y);
    col = mix(col, mix(uHor, vec3(1.0), 0.7) * (0.65 + 0.35 * length(uSunCol)), cl * 0.55);
    float st = step(0.9965, h2(floor(dir.xz / (y + 0.2) * 150.0)));
    col += vec3(st) * uStars * smoothstep(0.1, 0.5, y);
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
