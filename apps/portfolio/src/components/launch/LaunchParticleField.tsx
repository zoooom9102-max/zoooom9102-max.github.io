import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/**
 * WebGL port of ricardochance.com's particle monogram, reverse-engineered
 * from its production bundle (see AGENT_HANDOFF.md §4 for the full parameter
 * sheet). One renderer draws three layers:
 *   1. Fullscreen shader background — gradient + fbm-displaced morphing blob.
 *   2. Warp starfield (THREE.Points, CPU-projected like the reference).
 *   3. WL monogram point cloud with real depth: extruded z-slab, spin-in
 *      formation, cylindrical cursor cavity in group-local space (rotates
 *      with the group tilt), and a scroll-scrubbed disintegration copied
 *      from the reference's hero morph system: the group spins 720° while
 *      each particle spirals toward its spawn point (e×360° around Y,
 *      deep z spread), shrinking and dimming as it recedes — the spiral
 *      arms and spinning-disc read give the cloud its 3D volume.
 */

type ParticleTone = "cream" | "orange" | "white";

interface LogoParticle {
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  x: number;
  y: number;
  z: number;
  offX: number;
  offY: number;
  size: number;
  depth: number;
  phase: number;
  noisePhase: number;
  formDelay: number;
  dissolveDelay: number;
  /** Global-dissolve value at which this particle has fully scattered. */
  dissolveEnd: number;
  hasTwinkle: boolean;
  twinklePhase: number;
  twinkleSpeed: number;
  twinkle: number;
  tone: ParticleTone;
  /** Contour particle sampled exactly on the vector-accurate outline. */
  rim: boolean;
}

interface Star {
  x: number;
  y: number;
  z: number;
  speed: number;
  baseSize: number;
  brightness: number;
  phase: number;
  twinkleSpeed: number;
  offX: number;
  offY: number;
  tone: ParticleTone;
}

interface PointerState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  visible: boolean;
  dragging: boolean;
  pointerType: string;
  lastMove: number;
}

interface LaunchParticleFieldProps {
  /** Shared scroll-scrub progress (0 formed → 1 fully dissolved). */
  progressRef: RefObject<number>;
  /** Skip the fly-in formation (used when returning from the hero). */
  introDone?: boolean;
  /** Delay before the monogram starts converging (text lands first). */
  formationDelayMs?: number;
  /** Freeze the loop (kept for safety; the gate normally unmounts). */
  isFrozen?: boolean;
}

const LOGO_SOURCE_WIDTH = 768;
const LOGO_SOURCE_HEIGHT = 512;

// --- Reference-tuned monogram parameters (module 58620 of the bundle) ---
const SIZE_FILL = 0.68; // reference verbatim: ink fills 68% of min dimension
const CENTER_Y_RATIO = 0.55; // monogram sits slightly below center
const FACE_DEPTH_RATIO = 0.11; // reference FACE_DEPTH (slab thickness)
// Reference shape recipe: 20% of particles sampled exactly on the outline by
// arc length (marching-squares contour chained into polylines), the rest
// uniformly over the surface (rejection sampling, subpixel positions).
const CONTOUR_PARTICLE_RATIO = 0.2; // reference verbatim
// Reference camera/size basis verbatim: DEPTH_SIZE_REF 5600 @ camera z 800.
const LOGO_SIZE_REF = 5600;
const FORM_DURATION_MS = 2000; // reference: dissolve 1→0 over 2s linear
const FORM_STAGGER = 0.72;
const FORM_SPIN = Math.PI * 2; // spin-in rotation during formation
// Text-page anchors on the gate axis (SCROLL_RANGE_RATIO 3.4): page 2
// rests at progress ≈0.294, page 3 at ≈0.588. The owner's beats: scatter
// begins once the board has turned 90° (progress ≈0.157); page 2 settles
// exactly as the board completes 180°, already thinning but formed; by
// page 3 the silhouette and particles are fully scattered.
const DISSOLVE_START = 0.157; // the 90° point of the sweep
// Fully scattered by 0.56: as page 3 settles (≈0.588) the rim skeleton
// has peeled away and the outline is unreadable.
const DISSOLVE_END = 0.56;
const DISSOLVE_ROTATION = Math.PI * 2; // 360° around Y while scattering
// Rim schedule (owner's 20° rule): the outline stays readable through the
// 180° landing (dissolve ≈0.34), then peels fast — completely gone by
// dissolve ≈0.42, exactly 20° of extra sweep (progress ≈0.324). Only the
// loose scattered fill remains afterwards, emptying out by DISSOLVE_END.
const RIM_DISSOLVE_DELAY = 0.3; // + random × 0.06 per particle
const RIM_DISSOLVE_END = 0.42;
// The monogram sweeps around the vertical centerline (Y axis) from right
// to left: exactly 180° as page 2 settles (t = 0.5 at progress 0.294),
// then keeps turning past 180° while scattering — 360° total (owner:
// "最大旋转角度变大，大于 180°").
const Y_SPIN_START = 0.02;
const Y_SPIN_END = 0.568;
const Y_SPIN_ANGLE = Math.PI * 2; // 360° max; 180° lands on page 2's rest
// Gate tile-transition window — MUST mirror LaunchGate.tsx
// (TILE_TRANSITION_START / span / TILE_COVERED_AT). While the tiles fully
// cover the gate, the canvas is CSS-hidden, so the render loop skips
// update+render entirely and only keeps the cursor spring alive.
const GATE_TILE_START = 0.75;
const GATE_TILE_SPAN = 0.245;
const GATE_COVERED_T = 0.47;
// Reference high-tier rig values: 40% of particles twinkle at intensity 3.5
// (tier config overrides the global footer default 2.5).
const TWINKLE_PERCENT = 0.4;
const TWINKLE_INTENSITY = 3.5;
const GROUP_LOOK_TILT = 0.58;
const GROUP_TILT_SPEED = 9;
// Reference cavity radius is absolute 78 world units (radius² 6084 in bundle).
const CAVITY_RADIUS = 78;
const CAVITY_STRENGTH = 34;
const CAVITY_RETURN = 5.2;
const CAMERA_Z = 800;

// --- Warp starfield (reference star engine) ---
const STAR_FOV_TAN = Math.tan(((55 * Math.PI) / 180) / 2);
const STAR_FAR_MIN = 900;
const STAR_FAR_MAX = 2400;
const STAR_DESPAWN_Z = 80;
const STAR_SIZE_REF = 520; // reference basis: size × 520/depth, no cap
const STAR_XY_SPREAD = 1.05;
const STAR_CURSOR_RADIUS = 220;
const STAR_CURSOR_DEPTH_REF = 450;
const STAR_BULGE = 42;
const STAR_RETURN = 3.2;

const CREAM: [number, number, number] = [0.98, 0.94, 0.86];
const ORANGE: [number, number, number] = [1.0, 0.44, 0.08];
// Reference brightness mechanism (bundle-verified): the monogram's base
// colour is DARK — GLOBAL_PARTICLE_COLORS = #58467b, linear ≈ 0.1 — so a
// lone interior particle renders dim (~0.5 display), while the dense
// contour band additively stacks 3-4 layers into a bright edge. The
// edge-bright / interior-dim read is dark base × density, NOT a brightness
// attribute. Brand-mapped at the same luminance: W dim warm grey stacking
// to white, L dim orange stacking to vivid orange (low green prevents the
// additive yellow-shift verified by pixel sampling).
const LOGO_WHITE: [number, number, number] = [0.104, 0.098, 0.09];
const LOGO_WHITE_RIM: [number, number, number] = [0.104, 0.098, 0.09];
const LOGO_ORANGE: [number, number, number] = [0.104, 0.035, 0.006];
const LOGO_ORANGE_RIM: [number, number, number] = [0.104, 0.035, 0.006];

const POINTS_VERTEX_SHADER = `
uniform float uSizeRef;
uniform float uLocalZExtent;
uniform float uZAlphaMin;
uniform float uZAlphaMax;

attribute float size;
attribute float brightness;
attribute float opacity;
attribute vec3 color;

varying vec3 vColor;
varying float vBrightness;
varying float vOpacity;

void main() {
  vColor = color;
  float localExtent = max(uLocalZExtent, 1.0);
  float zNorm = clamp(position.z / localExtent, -1.0, 1.0);
  float depthAlpha = mix(uZAlphaMin, uZAlphaMax, zNorm * 0.5 + 0.5);
  vOpacity = opacity * depthAlpha;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

  // Group-center depth keeps tilt from inflating size on one edge.
  float centerDepth = max(-mvCenter.z, 1.0);
  float depthScale = uSizeRef / centerDepth;
  float localZFactor = clamp(1.0 + (position.z / localExtent) * 0.1, 0.9, 1.1);

  float sizeScale = depthScale * localZFactor;
  // Reference has no DPR compensation: point sizes are raw device px, so
  // particles stay fine-grained on high-DPR screens (verified in bundle).
  gl_PointSize = clamp(size * sizeScale, 0.0, 64.0);
  vBrightness = brightness * clamp(sizeScale, 0.72, 1.22);
  gl_Position = projectionMatrix * mvPosition;
}
`;

// Star sprite — reference verbatim: hard disc, soft core, NormalBlending.
// Dim by design (alpha ×0.26); the glow comes from the bloom pass instead.
const STAR_FRAGMENT_SHADER = `
precision highp float;

varying vec3 vColor;
varying float vBrightness;
varying float vOpacity;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = dot(uv, uv);
  if (dist > 0.25) discard;

  float core = smoothstep(0.25, 0.06, dist);
  float alpha = core * 0.26 * clamp(vBrightness, 0.0, 2.5) * vOpacity;
  vec3 rgb = vColor * (0.4 + vBrightness * 0.7);

  gl_FragColor = vec4(rgb, alpha);
}
`;

const POINTS_FRAGMENT_SHADER = `
precision highp float;

uniform float uGlowBoost;
uniform float uHaloStrength;
uniform float uBrightnessGain;
uniform float uAlphaGain;

varying vec3 vColor;
varying float vBrightness;
varying float vOpacity;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = dot(uv, uv);
  if (dist > 0.25) discard;

  float core = smoothstep(0.14, 0.0, dist);
  float halo = smoothstep(0.25, 0.035, dist);
  float shape = core + halo * uHaloStrength;

  float alpha = shape * vOpacity * clamp(vBrightness, 0.0, 3.0) * uAlphaGain;
  // uBrightnessGain below 1 keeps additive stacking from clipping the
  // green channel into yellow (dense logo particles overlap constantly).
  vec3 rgb = vColor * (0.72 + vBrightness * 1.05 * uBrightnessGain);
  rgb *= 1.0 + core * uGlowBoost;

  gl_FragColor = vec4(rgb, alpha * 0.82);
}
`;

// Brand-mapped gradient blob (reference: #0D0718/#3F2476, displacement .55,
// morph speed 1.3, randomness .35 — retinted to the warm-black/orange brand).
const BACKGROUND_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Background — VERBATIM PORT of the reference blob shader (bundle ru).
// Only the palette is brand-mapped: uColor1/uColor2 keep the reference's
// luminance range (#0D0718 ≈ lum 11 / #3F2476 ≈ lum 53) in warm ember hues.
// Reference defaults: displacement .55, morphSpeed 1.3, randomness .35,
// colorBlend 1, weights [0,100]. No vignette, no scroll displacement — the
// reference shader has neither; darkness comes from the palette ramp.
const BACKGROUND_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uWeight1;
uniform float uWeight2;
uniform float uBlobRandomness;
uniform float uBlobDisplacement;
uniform float uBlobMorphSpeed;
uniform float uColorBlend;

varying vec2 vUv;

const float BLOB_SCALE = 0.35;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.72;
  mat2 rot = mat2(0.87, -0.5, 0.5, 0.87);

  for (int i = 0; i < 2; i++) {
    value += amplitude * snoise(p);
    p = rot * p * 1.55 + 19.7;
    amplitude *= 0.55;
  }

  return value;
}

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// Warp suave: intensidad controlada por u_blobDisplacement
vec2 domainWarp(vec2 p, float time, float displacement) {
  float t1 = time * 0.13;
  float t2 = time * 0.087;

  vec2 q = vec2(
    fbm(p + vec2(t1, t2)),
    fbm(p + vec2(4.7, 2.3) + vec2(-t2, t1))
  );

  return p + q * mix(0.0, 0.28, displacement);
}

// u_blobRandomness controla cuánto varía la forma entre capas
float fbmAnimated(vec2 p, float phase, float randomness) {
  float value = 0.0;
  float amplitude = 0.72;
  mat2 rot = mat2(0.87, -0.5, 0.5, 0.87);
  float evolutionAmp = mix(0.04, 0.14, randomness);

  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 evolution = vec2(
      sin(phase * (0.28 + fi * 0.12) + fi * 2.1),
      cos(phase * (0.24 + fi * 0.1) - fi * 1.7)
    ) * (evolutionAmp + fi * evolutionAmp * 0.35);

    value += amplitude * snoise(p + evolution);
    p = rot * p * 1.55 + 19.7;
    amplitude *= 0.55;
  }

  return value;
}

float smoother(float t) {
  return t * t * (3.0 - 2.0 * t);
}

float colorTransition(float lt) {
  return mix(step(0.5, lt), smoother(lt), uColorBlend);
}

vec3 palette2(float t) {
  t = clamp(t, 0.0, 1.0);

  float total = uWeight1 + uWeight2;
  float w2 = total > 0.001 ? uWeight2 / total : 0.55;

  // Mezcla continua en todo el rango — sin zonas planas de un solo color
  float biased = pow(t, mix(1.0, max(w2, 0.2), uColorBlend * 0.65 + 0.35));
  float blendT = smoother(smoother(biased));

  return mix(uColor2, uColor1, colorTransition(blendT));
}

void main() {
  vec2 uv = vUv * 2.0; // reference triangle uv spans 0..2
  float time = uTime * uBlobMorphSpeed;

  vec2 centered = (uv - 1.0) * BLOB_SCALE;

  float swirl = time * 0.17;
  vec2 swirled = rot2(swirl * mix(0.0, 0.35, uBlobDisplacement)) * centered;

  vec2 nBase = domainWarp(swirled, time, uBlobDisplacement);

  float tA = time * 0.21;
  float tB = time * 0.14;
  float n1 = fbmAnimated(nBase, tA, uBlobRandomness);
  float n2 = fbmAnimated(nBase + vec2(8.3, 5.1), tB + 1.3, uBlobRandomness);
  float n3 = fbmAnimated(
    nBase + vec2(-6.2, 9.4),
    tA * 0.85 + tB * 0.6 + 2.7,
    uBlobRandomness
  );

  float fieldCoherent = n1 * 0.58 + n2 * 0.24 + n3 * 0.18;
  float fieldChaotic = (n1 + n2 + n3) / 3.0;
  float field = mix(fieldCoherent, fieldChaotic, uBlobRandomness) + 0.02;

  float edge = mix(0.14, 0.58, uColorBlend);
  float mask = smoothstep(-edge, edge, field);
  float maskSmooth = smoother(smoother(mask));
  mask = mix(mask, maskSmooth, uColorBlend);

  float spatial = smoother(clamp(uv.y * 0.46 + (1.0 - uv.x) * 0.2, 0.0, 1.0));
  float detail = fbmAnimated(
    nBase * 1.3 + vec2(3.1, -2.8),
    time * 0.32,
    uBlobRandomness
  ) * mix(0.002, 0.012, uBlobRandomness);

  float rampRaw = clamp(mask * 0.4 + spatial * 0.48 + detail + 0.02, 0.0, 1.0);
  float expo = mix(3.8, 0.82, uColorBlend);
  rampRaw = pow(rampRaw, expo);

  float rampLo = mix(0.0, 0.04, uColorBlend);
  float rampHi = mix(1.0, 0.78, uColorBlend);
  float rampT = (rampRaw - rampLo) / max(rampHi - rampLo, 0.001);

  gl_FragColor = vec4(palette2(rampT), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Trail warp FBO system — VERBATIM PORT of the reference's ping-pong mouse
// trail (bundle shaders rb + rx). Architecture: a trail texture is updated
// each frame (fade ×0.968^60dt, stamp a noisy blob along the smoothed pointer
// segment, channels r=trail g=headDist b=scale); a composite pass then warps
// the rendered background+star scene along the trail's gradient direction.
// The trail itself is never drawn — it displaces the scene underneath it.
// ---------------------------------------------------------------------------

// Shared snoise/fbm block used by both trail shaders (reference 3-octave fbm,
// amplitude .55/.48, rot×2.05 — different from the background blob's fbm).
const TRAIL_NOISE_GLSL = `
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;
  mat2 rot = mat2(0.87, -0.5, 0.5, 0.87);
  for (int i = 0; i < 3; i++) {
    value += amplitude * snoise(p);
    p = rot * p * 2.05 + 19.7;
    amplitude *= 0.48;
  }
  return value;
}
`;

// Trail update pass (reference shader rb). Writes vec4(trail, headDist,
// scale, 1): fade previous, stamp pointer segment, age/retract on disengage.
const TRAIL_UPDATE_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D u_trailPrev;
uniform vec2 u_pointer;
uniform vec2 u_pointerPrev;
uniform float u_pointerEngage;
uniform float u_pointerRadius;
uniform vec2 u_resolution;
uniform float u_fade;
uniform float u_disengage;
uniform float u_ageRate;
uniform float u_time;

varying vec2 vUv;

const float TRAIL_LEN_NORM = 0.38;

${TRAIL_NOISE_GLSL}

vec2 toAspect(vec2 uv) {
  return vec2(uv.x * u_resolution.x / u_resolution.y, uv.y);
}

float distToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float len2 = dot(ba, ba);
  if (len2 < 0.00001) return length(p - a);
  float t = clamp(dot(p - a, ba) / len2, 0.0, 1.0);
  return length(p - a - ba * t);
}

float headDistForPoint(vec2 p, vec2 prev, vec2 cur) {
  vec2 ba = cur - prev;
  float len2 = dot(ba, ba);
  if (len2 < 0.00001) return length(p - cur) / TRAIL_LEN_NORM;
  float t = clamp(dot(p - prev, ba) / len2, 0.0, 1.0);
  return (1.0 - t) * sqrt(len2) / TRAIL_LEN_NORM;
}

float exitScale(float headDist) {
  return clamp(1.0 - (u_disengage * 1.2 - (1.0 - headDist)), 0.0, 1.0);
}

float stampBlob(vec2 p, vec2 center, float radius, float engage) {
  float dist = length(p - center);
  vec2 nCoord = p * 4.2 + vec2(u_time * 0.22, -u_time * 0.19);
  float edgeNoise = fbm(nCoord) * radius * 0.42;
  edgeNoise += fbm(nCoord * 1.85 + 3.7 - u_time * 0.31) * radius * 0.22;
  float edge = radius + edgeNoise;
  float soft = radius * 0.22 + 0.012;
  float blob = 1.0 - smoothstep(edge, edge + soft, dist);
  float pulse = 0.88 + 0.12 * sin(u_time * 1.6 + fbm(p * 2.0) * 3.0);
  return blob * engage * pulse;
}

float stampSegment(vec2 p, vec2 a, vec2 b, float radius, float engage) {
  float dist = min(distToSegment(p, a, b), length(p - b));
  vec2 nCoord = p * 4.2 + vec2(u_time * 0.22, -u_time * 0.19);
  float edgeNoise = fbm(nCoord) * radius * 0.42;
  edgeNoise += fbm(nCoord * 1.85 + 3.7 - u_time * 0.31) * radius * 0.22;
  float edge = radius + edgeNoise;
  float soft = radius * 0.22 + 0.012;
  float blob = 1.0 - smoothstep(edge, edge + soft, dist);
  float pulse = 0.88 + 0.12 * sin(u_time * 1.6 + fbm(p * 2.0) * 3.0);
  return blob * engage * pulse;
}

void main() {
  vec2 uv = vUv;
  vec4 prev = texture2D(u_trailPrev, uv);
  float trail = prev.r * u_fade;
  float headDist = prev.g;
  float scale = prev.b;

  if (u_pointerEngage > 0.008) {
    vec2 p = toAspect(uv);
    vec2 cur = toAspect(u_pointer);
    vec2 prevPt = toAspect(u_pointerPrev);
    float radius = u_pointerRadius * (0.5 + u_pointerEngage * 0.35);

    float stamp = stampSegment(p, prevPt, cur, radius, u_pointerEngage);
    float stampHeadDist = headDistForPoint(p, prevPt, cur);

    vec2 seg = cur - prevPt;
    float segLen = length(seg);
    if (segLen > 0.0001) {
      float step = radius * 0.22;
      int nSteps = int(clamp(segLen / step, 1.0, 12.0));
      for (int i = 0; i <= 12; i++) {
        if (i > nSteps) break;
        float t = float(i) / float(nSteps);
        vec2 pt = mix(prevPt, cur, t);
        float blob = stampBlob(p, pt, radius, u_pointerEngage);
        if (blob > stamp) {
          stamp = blob;
          stampHeadDist = (1.0 - t) * segLen / TRAIL_LEN_NORM;
        }
      }
    } else {
      float blob = stampBlob(p, cur, radius, u_pointerEngage);
      if (blob > stamp) {
        stamp = blob;
        stampHeadDist = 0.0;
      }
    }

    if (stamp > trail) {
      trail = stamp;
      headDist = clamp(stampHeadDist, 0.0, 1.0);
      scale = 1.0;
    } else if (trail > 0.001) {
      headDist = min(headDist + u_ageRate, 1.0);
      scale = 1.0;
    }
  } else if (trail > 0.001) {
    scale = exitScale(headDist);
    trail *= scale;
  } else {
    headDist = 0.0;
    scale = 0.0;
  }

  gl_FragColor = vec4(trail, headDist, scale, 1.0);
}
`;

// Warp composite pass (reference shader rx): displaces the rendered scene
// along the trail direction, with a flow-noise base and a deep-mix second
// sample. The trail is invisible on its own — only its warp shows.
const WARP_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D u_scene;
uniform sampler2D u_trail;
uniform float u_time;
uniform float u_pointerEngage;
uniform vec2 u_resolution;

varying vec2 vUv;

${TRAIL_NOISE_GLSL}

vec2 toAspect(vec2 uv) {
  return vec2(uv.x * u_resolution.x / u_resolution.y, uv.y);
}

vec2 fromAspect(vec2 p) {
  return vec2(p.x / (u_resolution.x / u_resolution.y), p.y);
}

vec2 trailBlobCenter(vec2 uv) {
  vec2 texel = vec2(1.0 / u_resolution.x, 1.0 / u_resolution.y);
  vec2 p = uv;
  for (int i = 0; i < 4; i++) {
    float c = texture2D(u_trail, p).r;
    if (c < 0.0001) break;
    float r = texture2D(u_trail, clamp(p + vec2(texel.x, 0.0), 0.0, 1.0)).r;
    float l = texture2D(u_trail, clamp(p - vec2(texel.x, 0.0), 0.0, 1.0)).r;
    float u = texture2D(u_trail, clamp(p + vec2(0.0, texel.y), 0.0, 1.0)).r;
    float d = texture2D(u_trail, clamp(p - vec2(0.0, texel.y), 0.0, 1.0)).r;
    vec2 grad = vec2(r - l, u - d);
    float len = length(grad);
    if (len < 0.00001) break;
    p += (grad / len) * texel.x * 1.6;
  }
  return clamp(p, 0.0, 1.0);
}

float trailBlobScaled(vec2 uv) {
  vec4 data = texture2D(u_trail, uv);
  float intensity = data.r;
  float scale = data.b;
  if (intensity < 0.001) return 0.0;
  if (scale > 0.985) return intensity;
  vec2 center = trailBlobCenter(uv);
  vec2 scaledUv = center + (uv - center) / max(scale, 0.025);
  float scaledIntensity = texture2D(u_trail, clamp(scaledUv, 0.0, 1.0)).r;
  return scaledIntensity * smoothstep(0.0, 0.12, scale);
}

vec4 sampleScene(vec2 uv) {
  return texture2D(u_scene, clamp(uv, 0.0, 1.0));
}

// Deforma el patrón del fondo siguiendo la dirección del trazo
vec2 patternWarp(vec2 uv, float blob) {
  vec2 p = toAspect(uv);
  vec2 nBase = p * 3.2 + vec2(u_time * 0.16, -u_time * 0.13);
  float n1 = fbm(nBase);
  float n2 = fbm(nBase * 1.65 + vec2(5.1, 2.4) - u_time * 0.11);
  float n3 = fbm(nBase * 2.1 - u_time * 0.2 + 8.0);
  vec2 flow = vec2(n1 - n2, n2 - n3);
  flow *= 2.4;
  vec2 texel = vec2(1.0 / u_resolution.x, 1.0 / u_resolution.y);
  float tC = trailBlobScaled(uv);
  float tR = trailBlobScaled(clamp(uv + vec2(texel.x, 0.0), 0.0, 1.0));
  float tU = trailBlobScaled(clamp(uv + vec2(0.0, texel.y), 0.0, 1.0));
  vec2 grad = vec2(tR - tC, tU - tC);
  float gradLen = length(grad);
  vec2 vel = gradLen > 0.00008 ? grad / gradLen : vec2(0.0);
  vec2 right = vec2(-vel.y, vel.x);
  flow += vel * blob * 1.4;
  flow += right * blob * 0.65;
  float amp = blob * (0.028 + u_pointerEngage * 0.022);
  return fromAspect(flow * amp);
}

void main() {
  vec2 uv = vUv;
  vec4 base = sampleScene(uv);
  float blob = trailBlobScaled(uv);
  if (blob < 0.001) {
    gl_FragColor = base;
    return;
  }
  vec2 warp = patternWarp(uv, blob);
  vec4 warped = sampleScene(uv + warp);
  vec4 warpedDeep = sampleScene(uv + warp * 1.35 + vec2(warp.y, -warp.x) * 0.15);
  vec4 displaced = mix(warped, warpedDeep, blob * 0.4);
  gl_FragColor = mix(base, displaced, clamp(blob * 0.98, 0.0, 1.0));
}
`;

const createRandom = (initialSeed: number) => {
  let seed = initialSeed >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Reference rw() easing verbatim: fast rate 10 when snapping to the "up"
// extreme or rising to max, slow 10/7 when gliding back toward 1.
const rwEase = (current: number, target: number, upSpeed: number, dt: number) => {
  const rate =
    target === upSpeed
      ? 10
      : (target === 1 && current < 1) || target < current
        ? 10 / 7
        : 10;
  let next = current + (target - current) * (1 - Math.exp(-rate * dt));
  if (Math.abs(next - target) < 0.001) next = target;
  return next;
};

// Rotate a center-relative point around the Y axis (reference rV, axis "y").
const rotateY = (x: number, z: number, angle: number) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
};

// Cursor-only fallback for when WebGL context creation fails (observed on
// cold GPU processes in embedded webviews: first preview launch + first
// refresh). `.launch-gate *` hides the OS cursor with cursor:none, so
// without this the pointer would vanish entirely. Mirrors the main loop's
// dot+spring-ring behaviour; returns a cleanup.
const attachCursorFallback = (
  cursorDot: HTMLElement,
  cursorRing: HTMLElement,
) => {
  const pointer = { x: 0, y: 0, visible: false, pointerType: "mouse" };
  const ring = { x: 0, y: 0, vx: 0, vy: 0 };
  let frame: number | null = null;
  let lastTime = 0;
  let isDocumentVisible = !document.hidden;

  const showCursor = () => {
    cursorDot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
    if (pointer.visible && pointer.pointerType !== "touch") {
      cursorDot.style.opacity = "1";
      cursorRing.style.opacity = "1";
    }
  };

  const tick = (time: number) => {
    frame = null;
    if (!isDocumentVisible) return;
    const delta = lastTime ? Math.min(34, time - lastTime) : 16.667;
    lastTime = time;
    cursorDot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
    const stiffness = 520 / 0.45;
    const damping = 42 / 0.45;
    const step = Math.min(delta, 34) / 1000;
    ring.vx += (-(ring.x - pointer.x) * stiffness - ring.vx * damping) * step;
    ring.vy += (-(ring.y - pointer.y) * stiffness - ring.vy * damping) * step;
    ring.x += ring.vx * step;
    ring.y += ring.vy * step;
    cursorRing.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
    frame = window.requestAnimationFrame(tick);
  };
  const ensureFrame = () => {
    if (frame === null && isDocumentVisible) {
      frame = window.requestAnimationFrame(tick);
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.visible = true;
    pointer.pointerType = event.pointerType;
    showCursor();
  };
  const handlePointerLeave = () => {
    pointer.visible = false;
    cursorDot.style.opacity = "0";
    cursorRing.style.opacity = "0";
  };
  const handleVisibility = () => {
    isDocumentVisible = !document.hidden;
    if (!isDocumentVisible && frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    } else {
      lastTime = 0;
      ensureFrame();
    }
  };

  window.addEventListener("pointermove", handlePointerMove, {
    passive: true,
  });
  window.addEventListener("pointerdown", handlePointerMove, {
    passive: true,
  });
  document.documentElement.addEventListener(
    "pointerleave",
    handlePointerLeave,
  );
  document.addEventListener("visibilitychange", handleVisibility);
  ensureFrame();

  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerdown", handlePointerMove);
    document.documentElement.removeEventListener(
      "pointerleave",
      handlePointerLeave,
    );
    document.removeEventListener("visibilitychange", handleVisibility);
  };
};

export function LaunchParticleField({
  progressRef,
  introDone = false,
  formationDelayMs = 0,
  isFrozen = false,
}: LaunchParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const isFrozenRef = useRef(isFrozen);
  const cancelFrameRef = useRef<(() => void) | null>(null);
  // WebGL context creation can fail on a cold GPU process (embedded
  // webviews); retry the whole init a few times before settling for the
  // CSS-gradient + cursor fallback.
  const [webglRetry, setWebglRetry] = useState(0);
  // The fallback cursor lives in its OWN effect so the boot-retry cycle
  // never detaches/resets it — previously each retry bounced the cursor
  // back to (0,0) while the GPU was still cold.
  const [webglDead, setWebglDead] = useState(false);

  useEffect(() => {
    if (!webglDead) return;
    const dot = cursorDotRef.current;
    const ring = cursorRingRef.current;
    if (!dot || !ring) return;
    return attachCursorFallback(dot, ring);
  }, [webglDead]);

  useEffect(() => {
    isFrozenRef.current = isFrozen;
    if (isFrozen) cancelFrameRef.current?.();
  }, [isFrozen]);

  useEffect(() => {
    let canvas = canvasRef.current;
    const cursorDot = cursorDotRef.current;
    const cursorRing = cursorRingRef.current;
    if (!canvas || !cursorDot || !cursorRing) return;

    // StrictMode double-mounts this effect in dev (mount → cleanup →
    // mount). Every async entry point below — the rAF loop, the logo
    // image callbacks, visibility/contextlost events, ensureAnimation —
    // MUST check this flag: the first mount's logo image finishes loading
    // AFTER the cleanup disposed its renderer/geometries, and its zombie
    // closure then rendered onto disposed GPU objects sharing the second
    // mount's canvas — the root cause of the intermittent "no stars, no
    // cursor, thousands of console errors" bug (probe-verified 6/6 on the
    // dev server: two "[launch] booted" lines + bad-frame TypeError).
    let disposed = false;

    // A canvas that already hosted a FAILED or LOST WebGL context keeps
    // returning that same poisoned context to every new renderer — swap in
    // a fresh element on retries so each attempt starts clean (this is the
    // classic "works after one refresh, dead after the next" trap).
    if (webglRetry > 0) {
      const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      canvasRef.current = fresh;
      canvas = fresh;
    }

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const saveData = (
      navigator as Navigator & {
        connection?: { saveData?: boolean };
      }
    ).connection?.saveData;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      // WebGL unavailable (cold GPU process in embedded webviews — the
      // reported "cursor gone on first preview launch" case: cursor:none
      // hides the OS cursor while the custom cursor listeners were never
      // attached). The dot+ring fallback is owned by the webglDead effect
      // so it survives the retry cycle untouched.
      console.error(
        `[launch] WebGL renderer construction failed (retry ${webglRetry})`,
        error,
      );
      setWebglDead(true);
      let retryTimer: number | null = null;
      // 8 attempts × 700ms ≈ 5.6s of coverage — a cold GPU process can
      // take several seconds to warm up after a hard refresh.
      if (webglRetry < 8) {
        retryTimer = window.setTimeout(
          () => setWebglRetry((n) => n + 1),
          700,
        );
      }
      return () => {
        if (retryTimer !== null) window.clearTimeout(retryTimer);
      };
    }
    const gl = renderer;
    setWebglDead(false);

    // The WHOLE boot below is guarded: any synchronous failure (composer,
    // FBO allocation, shader setup on a cold or busy GPU process) drops
    // into the same fallback+retry path as a renderer-construction
    // failure — never again "cursor hidden, no custom cursor, no stars".
    try {
    // Reference graphics tiers (bundle-verified): the high tier forces dpr 2
    // even on DPR-1 displays — that supersampling is what keeps 4000 monogram
    // particles grainy (measured dot Ø ~5-7 CSS px) instead of merging into a
    // solid mass. Medium (coarse pointer) caps at 1.5, low (saveData /
    // reduced-motion) stays at 1.
    const coarsePointer = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;
    const pixelRatio =
      saveData || reducedMotionQuery.matches
        ? 1
        : coarsePointer
          ? Math.min(window.devicePixelRatio || 1, 1.5)
          : 2;
    gl.setPixelRatio(pixelRatio);

    // --- Background layer ---
    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const bgUniforms = {
      uTime: { value: 0 },
      // Brand-mapped palette, PRE-LINEARIZED: the composer chain ends in
      // UnrealBloomPass whose composite applies linear→sRGB, so shader
      // outputs are gamma-encoded before display. Author the intended
      // DISPLAY colours (ref luminance range: dark ~16/10/7, ember
      // ~72/38/9) and store their linear values here.
      uColor1: { value: new THREE.Vector3(0.01, 0.0037, 0.0018) },
      uColor2: { value: new THREE.Vector3(0.052, 0.0125, 0.0005) },
      uWeight1: { value: 0 },
      uWeight2: { value: 100 },
      uBlobRandomness: { value: 0.35 },
      uBlobDisplacement: { value: 0.55 },
      uBlobMorphSpeed: { value: 1.3 },
      uColorBlend: { value: 1 },
    };
    bgScene.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          vertexShader: BACKGROUND_VERTEX_SHADER,
          fragmentShader: BACKGROUND_FRAGMENT_SHADER,
          uniforms: bgUniforms,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    );

    // --- Main scene (starfield only — see bloom note) ---
    const scene = new THREE.Scene();
    // --- Monogram scene: rendered AFTER the composer, no bloom (reference:
    // the glyph lives in a separate rig canvas without the bloom pipeline;
    // bloom exists only in the background/starfield canvas).
    const logoScene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, CAMERA_Z * 2);
    camera.position.set(0, 0, CAMERA_Z);

    // --- Post-processing: bloom over background + stars only. No OutputPass:
    // the composer chain ends on the bloom composite, so colours pass
    // through unchanged and only the glow is added.
    const composer = new EffectComposer(gl);

    // --- Trail warp FBO system (verbatim port of the reference) ---
    // Pipeline per frame: (1) trail ping-pong update, (2) bg+stars rendered
    // into a scene target at CSS resolution (reference fboScale=1 — the
    // composite upsamples, which is also why the reference's stars read
    // soft), (3) composer draws the warp-composite quad sampling both
    // textures, (4) bloom, (5) monogram on top unbloomed.
    const makeFbo = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: THREE.HalfFloatType,
        depthBuffer: false,
      });
    const sceneTarget = makeFbo(1, 1);
    let trailRead = makeFbo(1, 1);
    let trailWrite = makeFbo(1, 1);

    const trailUniforms = {
      u_trailPrev: { value: trailRead.texture },
      u_time: { value: 0 },
      u_pointer: { value: new THREE.Vector2(0.5, 0.5) },
      u_pointerPrev: { value: new THREE.Vector2(0.5, 0.5) },
      u_pointerEngage: { value: 0 },
      u_pointerRadius: { value: 0.1 },
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_fade: { value: 0.968 },
      u_disengage: { value: 0 },
      u_ageRate: { value: 0.018 },
    };
    const trailScene = new THREE.Scene();
    const trailMaterial = new THREE.ShaderMaterial({
      vertexShader: BACKGROUND_VERTEX_SHADER,
      fragmentShader: TRAIL_UPDATE_FRAGMENT_SHADER,
      uniforms: trailUniforms,
      depthTest: false,
      depthWrite: false,
    });
    trailScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMaterial));

    const warpUniforms = {
      u_scene: { value: sceneTarget.texture },
      u_trail: { value: trailRead.texture },
      u_time: { value: 0 },
      u_pointerEngage: { value: 0 },
      u_resolution: { value: new THREE.Vector2(1, 1) },
    };
    const warpScene = new THREE.Scene();
    const warpMaterial = new THREE.ShaderMaterial({
      vertexShader: BACKGROUND_VERTEX_SHADER,
      fragmentShader: WARP_FRAGMENT_SHADER,
      uniforms: warpUniforms,
      depthTest: false,
      depthWrite: false,
    });
    warpScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), warpMaterial));

    // Trail pointer state machine (reference field-for-field).
    const trail = {
      uv: { x: 0.5, y: 0.5 },
      uvPrev: { x: 0.5, y: 0.5 },
      uvSmooth: { x: 0.5, y: 0.5 },
      uvSmoothPrev: { x: 0.5, y: 0.5 },
      px: -9999,
      py: -9999,
      prevPx: -9999,
      prevPy: -9999,
      speed: 0,
      engagement: 0,
      vfxEngage: 0,
      disengageProgress: 0,
      active: false,
    };

    composer.addPass(new RenderPass(warpScene, bgCamera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.4, // strength — bloom adds star glow; measured zero haze impact
      0.5, // radius
      0.3, // threshold — background blob stays well below in linear space
    );
    composer.addPass(bloomPass);

    const createPointsMaterial = (
      localZExtent: number,
      zMin: number,
      zMax: number,
      brightnessGain = 1,
      glowBoost = 1.45,
      haloStrength = 0.78,
      alphaGain = 1,
      sizeRef = CAMERA_Z,
    ) =>
      new THREE.ShaderMaterial({
        vertexShader: POINTS_VERTEX_SHADER,
        fragmentShader: POINTS_FRAGMENT_SHADER,
        uniforms: {
          uSizeRef: { value: sizeRef },
          uLocalZExtent: { value: localZExtent },
          uZAlphaMin: { value: zMin },
          uZAlphaMax: { value: zMax },
          uGlowBoost: { value: glowBoost },
          uHaloStrength: { value: haloStrength },
          uBrightnessGain: { value: brightnessGain },
          uAlphaGain: { value: alphaGain },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

    // --- Starfield points (reference: NormalBlending, dim core-only sprite) ---
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.ShaderMaterial({
      vertexShader: POINTS_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      uniforms: {
        uSizeRef: { value: CAMERA_Z },
        uLocalZExtent: { value: 1 },
        uZAlphaMin: { value: 1 },
        uZAlphaMax: { value: 1 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const starPoints = new THREE.Points(starGeometry, starMaterial);
    starPoints.frustumCulled = false;
    starPoints.renderOrder = 0;
    scene.add(starPoints);

    // --- Monogram points inside a tiltable group (own scene, bloom-free) ---
    const monogramGroup = new THREE.Group();
    logoScene.add(monogramGroup);
    const logoGeometry = new THREE.BufferGeometry();
    const logoMaterial = createPointsMaterial(
      // Reference verbatim: uLocalZExtent = FOOTER_R_PARTICLE_Z_RANGE = 0.12
      // raw world units. The slab spans ±34 world units, so zNorm saturates
      // and depthAlpha is effectively FLAT 0.6 for all particles — the
      // reference's interior dimness is this flat 0.6, not a gradient.
      0.12,
      0.6,
      1,
      // Reference gain values verbatim (brightness 1, glow 1.45, halo 0.78);
      // alphaGain 0.85 is the one deliberate deviation — brand-orange
      // additive stacking clips the L's green channel into yellow at full
      // alpha on DPR-1 displays.
      1.0,
      1.45,
      0.78,
      0.85,
      LOGO_SIZE_REF,
    );
    const logoPoints = new THREE.Points(logoGeometry, logoMaterial);
    logoPoints.frustumCulled = false;
    logoPoints.renderOrder = 1;
    monogramGroup.add(logoPoints);

    const pointer: PointerState = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2,
      speed: 0,
      visible: false,
      dragging: false,
      pointerType: "mouse",
      lastMove: 0,
    };
    // Elastic ring cursor (hero PointerHalo spring: 520 / 42 / 0.45).
    const ring = { x: pointer.x, y: pointer.y, vx: 0, vy: 0 };

    let width = 1;
    let height = 1;
    let frame: number | null = null;
    let lastTime = 0;
    let frameErrors = 0;
    let bornAt = introDone ? -100000 : 0;
    let logoReady = false;
    let isDocumentVisible = !document.hidden;
    let particles: LogoParticle[] = [];
    let stars: Star[] = [];
    let logoWorldHeight = 60;
    let faceDepth = 20;
    let cavityRadius = CAVITY_RADIUS;
    // Background animation state: scroll boost (reference: down 1.8×, up 0.3×,
    // eased back to 1) and pointer engagement for the trail-like feedback.
    let lastProgress = 0;
    let scrollBoost = 1;
    let lastDeltaSeconds = 1 / 60;
    let starBoost = 1;

    // Monogram buffers
    let logoPositions = new Float32Array(0);
    let logoSizes = new Float32Array(0);
    let logoBrightness = new Float32Array(0);
    let logoOpacity = new Float32Array(0);
    // Star buffers
    let starPositions = new Float32Array(0);
    let starSizes = new Float32Array(0);
    let starBrightness = new Float32Array(0);
    let starOpacity = new Float32Array(0);

    const tiltTarget = new THREE.Quaternion();
    const tiltCurrent = new THREE.Quaternion();
    const tiltDirection = new THREE.Vector3(0, 0, 1);
    const tiltAxis = new THREE.Vector3(0, 0, 1);
    const ySpinAxis = new THREE.Vector3(0, 1, 0);
    const ySpinQuat = new THREE.Quaternion();
    const inverseTilt = new THREE.Quaternion();
    const localCursor = new THREE.Vector3();

    const spawnStar = (
      random: () => number,
      initial: boolean,
    ): Pick<Star, "x" | "y" | "z"> => {
      const z = initial
        ? -(STAR_FAR_MIN + random() * (STAR_FAR_MAX - STAR_FAR_MIN))
        : -(STAR_FAR_MAX - random() * (STAR_FAR_MAX - STAR_FAR_MIN) * 0.4);
      const halfH = STAR_FOV_TAN * Math.abs(z);
      const halfW = halfH * (width / Math.max(height, 1));
      return {
        x: (random() - 0.5) * 2 * halfW * STAR_XY_SPREAD,
        y: (random() - 0.5) * 2 * halfH * STAR_XY_SPREAD,
        z,
      };
    };

    const buildStars = () => {
      const random = createRandom(90417);
      const mobile = width < 680;
      // Reference shaderParticleCount tiers: high 10000 / medium 6000 / low 3000.
      const count = saveData ? 3000 : mobile ? 6000 : 10000;
      stars = Array.from({ length: count }, () => {
        const sparkle = random() < 0.2;
        return {
          ...spawnStar(random, true),
          speed: 40 * Math.pow(520 / 40, random()),
          // Reference: bright stars are also bigger (brightSizeMul 1.42).
          baseSize: (0.55 + random() * 1.1) * (sparkle ? 1.42 : 1),
          brightness: sparkle ? 2.05 : 0.68,
          phase: random() * Math.PI * 2,
          twinkleSpeed: 0.0006 + random() * 0.0016,
          offX: 0,
          offY: 0,
          tone: random() > 0.92 ? ("orange" as const) : ("cream" as const),
        };
      });
      starPositions = new Float32Array(count * 3);
      starSizes = new Float32Array(count);
      starBrightness = new Float32Array(count);
      starOpacity = new Float32Array(count);
      starGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(starPositions, 3),
      );
      starGeometry.setAttribute("size", new THREE.BufferAttribute(starSizes, 1));
      starGeometry.setAttribute(
        "brightness",
        new THREE.BufferAttribute(starBrightness, 1),
      );
      starGeometry.setAttribute(
        "opacity",
        new THREE.BufferAttribute(starOpacity, 1),
      );
      const starColors = new Float32Array(count * 3);
      stars.forEach((star, index) => {
        const [r, g, b] = star.tone === "orange" ? ORANGE : CREAM;
        starColors[index * 3] = r;
        starColors[index * 3 + 1] = g;
        starColors[index * 3 + 2] = b;
      });
      starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    };

    const buildParticles = (logoImage: HTMLImageElement) => {
      const source = document.createElement("canvas");
      source.width = LOGO_SOURCE_WIDTH;
      source.height = LOGO_SOURCE_HEIGHT;
      const sourceContext = source.getContext("2d", {
        willReadFrequently: true,
      });
      if (!sourceContext) return;

      sourceContext.clearRect(0, 0, source.width, source.height);
      sourceContext.drawImage(logoImage, 0, 0, source.width, source.height);
      const pixels = sourceContext.getImageData(
        0,
        0,
        source.width,
        source.height,
      ).data;
      const sw = source.width;
      const sh = source.height;
      // Ink bounding box: the reference scales the glyph geometry itself to
      // unit size, so SIZE_FILL applies to the ink — not to PNG canvas
      // padding. Cropping to the ink bbox restores the reference's
      // particle-per-screen-pixel density (and hence its crispness).
      let inkMinX = sw;
      let inkMinY = sh;
      let inkMaxX = -1;
      let inkMaxY = -1;
      for (let scanY = 0; scanY < sh; scanY += 1) {
        for (let scanX = 0; scanX < sw; scanX += 1) {
          if (pixels[(scanY * sw + scanX) * 4 + 3] >= 48) {
            if (scanX < inkMinX) inkMinX = scanX;
            if (scanX > inkMaxX) inkMaxX = scanX;
            if (scanY < inkMinY) inkMinY = scanY;
            if (scanY > inkMaxY) inkMaxY = scanY;
          }
        }
      }
      if (inkMaxX < 0) {
        inkMinX = 0;
        inkMinY = 0;
        inkMaxX = sw - 1;
        inkMaxY = sh - 1;
      }
      const inkW = inkMaxX - inkMinX + 1;
      const inkH = inkMaxY - inkMinY + 1;
      const inkCenterX = inkMinX + inkW / 2;
      const inkCenterY = inkMinY + inkH / 2;
      const alphaAt = (x: number, y: number) =>
        x < 0 || y < 0 || x >= sw || y >= sh
          ? 0
          : pixels[(y * sw + x) * 4 + 3];
      // Bilinear alpha for subpixel inside/outside tests.
      const alphaSmooth = (x: number, y: number) => {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        return (
          alphaAt(x0, y0) * (1 - fx) * (1 - fy) +
          alphaAt(x0 + 1, y0) * fx * (1 - fy) +
          alphaAt(x0, y0 + 1) * (1 - fx) * fy +
          alphaAt(x0 + 1, y0 + 1) * fx * fy
        );
      };
      const toneAt = (x: number, y: number): ParticleTone => {
        const cx = Math.min(sw - 1, Math.max(0, Math.round(x)));
        const cy = Math.min(sh - 1, Math.max(0, Math.round(y)));
        const index = (cy * sw + cx) * 4;
        return pixels[index] > 150 && pixels[index + 1] < 165
          ? "orange"
          : "white";
      };

      // --- Marching squares: subpixel outline at alpha iso 76 (reference:
      // 20% of particles sampled exactly on the shape's boundary edges,
      // uniformly by arc length — this is what makes the slab read crisp).
      const ISO = 76;
      type SegPt = { x: number; y: number };
      const segments: Array<[SegPt, SegPt]> = [];
      const pushSegment = (ax: number, ay: number, bx: number, by: number) => {
        if (Math.hypot(bx - ax, by - ay) < 1e-6) return;
        segments.push([
          { x: ax, y: ay },
          { x: bx, y: by },
        ]);
      };
      for (let y = 0; y < sh - 1; y += 1) {
        for (let x = 0; x < sw - 1; x += 1) {
          const v0 = alphaAt(x, y); // top-left
          const v1 = alphaAt(x + 1, y); // top-right
          const v2 = alphaAt(x + 1, y + 1); // bottom-right
          const v3 = alphaAt(x, y + 1); // bottom-left
          const code =
            (v0 >= ISO ? 8 : 0) |
            (v1 >= ISO ? 4 : 0) |
            (v2 >= ISO ? 2 : 0) |
            (v3 >= ISO ? 1 : 0);
          if (code === 0 || code === 15) continue;
          const topX = x + (ISO - v0) / (v1 - v0);
          const rightY = y + (ISO - v1) / (v2 - v1);
          const bottomX = x + (ISO - v3) / (v2 - v3);
          const leftY = y + (ISO - v0) / (v3 - v0);
          switch (code) {
            case 1:
            case 14:
              pushSegment(x, leftY, bottomX, y + 1);
              break;
            case 2:
            case 13:
              pushSegment(bottomX, y + 1, x + 1, rightY);
              break;
            case 3:
            case 12:
              pushSegment(x, leftY, x + 1, rightY);
              break;
            case 4:
            case 11:
              pushSegment(topX, y, x + 1, rightY);
              break;
            case 5:
              pushSegment(topX, y, x + 1, rightY);
              pushSegment(x, leftY, bottomX, y + 1);
              break;
            case 6:
            case 9:
              pushSegment(topX, y, bottomX, y + 1);
              break;
            case 7:
            case 8:
              pushSegment(topX, y, x, leftY);
              break;
            case 10:
              pushSegment(topX, y, x, leftY);
              pushSegment(bottomX, y + 1, x + 1, rightY);
              break;
            default:
              break;
          }
        }
      }

      // Link the unordered cell segments into ordered polylines. Shared
      // edge points are computed from identical grid values, so quantised
      // keys match exactly across adjacent cells.
      const ptKey = (p: SegPt) =>
        `${Math.round(p.x * 64)},${Math.round(p.y * 64)}`;
      const adjacency = new Map<string, number[]>();
      segments.forEach((segment, index) => {
        for (const pt of segment) {
          const key = ptKey(pt);
          const list = adjacency.get(key);
          if (list) list.push(index);
          else adjacency.set(key, [index]);
        }
      });
      const usedSegment = new Uint8Array(segments.length);
      const polylines: SegPt[][] = [];
      const extendChain = (chain: SegPt[]) => {
        for (;;) {
          const key = ptKey(chain[chain.length - 1]);
          const candidates = adjacency.get(key);
          if (!candidates) break;
          const next = candidates.find((index) => !usedSegment[index]);
          if (next === undefined) break;
          usedSegment[next] = 1;
          const [a, b] = segments[next];
          chain.push(ptKey(a) === key ? b : a);
        }
      };
      for (let index = 0; index < segments.length; index += 1) {
        if (usedSegment[index]) continue;
        usedSegment[index] = 1;
        const chain: SegPt[] = [segments[index][0], segments[index][1]];
        extendChain(chain);
        chain.reverse();
        extendChain(chain);
        chain.reverse();
        polylines.push(chain);
      }

      // Douglas-Peucker simplification (keeps the logo's hard corners,
      // drops staircase noise): reference samples boundary edges of a
      // vector glyph; this recovers equally clean straight runs.
      // CLOSED-LOOP FIX: chained contours end exactly where they start, and
      // the duplicated endpoint degenerates the DP chord test (first ≡ last
      // → every point's distance collapses to 0 → the whole loop simplified
      // to a ZERO-LENGTH path, piling all 800 rim particles on one anchor —
      // the bright knot). Strip the duplicate before simplifying.
      const simplify = (points: SegPt[], tolerance: number): SegPt[] => {
        if (points.length <= 2) return points;
        const first = points[0];
        const last = points[points.length - 1];
        if (
          points.length > 2 &&
          Math.hypot(last.x - first.x, last.y - first.y) < 1e-9
        ) {
          return simplify(points.slice(0, -1), tolerance);
        }
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const denom = Math.hypot(dx, dy) || 1;
        let maxDist = 0;
        let maxIndex = 0;
        for (let i = 1; i < points.length - 1; i += 1) {
          const dist =
            Math.abs(
              dy * points[i].x - dx * points[i].y + last.x * first.y - last.y * first.x,
            ) / denom;
          if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
          }
        }
        if (maxDist <= tolerance) return [first, last];
        const left = simplify(points.slice(0, maxIndex + 1), tolerance);
        const right = simplify(points.slice(maxIndex), tolerance);
        return left.slice(0, -1).concat(right);
      };
      const outlinePaths = polylines
        .map((chain) => simplify(chain, 0.35))
        .filter((chain) => chain.length >= 2);
      // Debug hook: contour pipeline stats for knot diagnosis.
      if (new URLSearchParams(window.location.search).has("debugParticles")) {
        (window as unknown as Record<string, unknown>).__contourDebug = {
          segments: segments.length,
          polylines: polylines.length,
          polylinePointCounts: polylines.slice(0, 10).map((c) => c.length),
          paths: outlinePaths.length,
          firstChainSample: polylines[0]
            ? polylines[0]
                .slice(0, 24)
                .map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100])
            : null,
          segmentSample: segments
            .slice(0, 6)
            .map(([a, b]) => [
              Math.round(a.x * 100) / 100,
              Math.round(a.y * 100) / 100,
              Math.round(b.x * 100) / 100,
              Math.round(b.y * 100) / 100,
            ]),
        };
      }
      const pathLengths = outlinePaths.map((chain) => {
        let length = 0;
        for (let i = 1; i < chain.length; i += 1) {
          length += Math.hypot(chain[i].x - chain[i - 1].x, chain[i].y - chain[i - 1].y);
        }
        return length;
      });
      const totalLength = pathLengths.reduce((sum, length) => sum + length, 0);
      if ((window as unknown as Record<string, unknown>).__contourDebug) {
        (
          (window as unknown as Record<string, unknown>).__contourDebug as {
            totalLength?: number;
            pathLengths?: number[];
          }
        ).totalLength = totalLength;
        (
          (window as unknown as Record<string, unknown>).__contourDebug as {
            totalLength?: number;
            pathLengths?: number[];
          }
        ).pathLengths = pathLengths.slice(0, 10).map((l) => Math.round(l));
      }

      const random = createRandom(20260725);
      const mobile = width < 680;
      // Reference particleCount tiers: high 4000 / medium 2800 / low 1800.
      const particleCount = saveData ? 1800 : mobile ? 2800 : 4000;
      const contourCount = Math.round(
        particleCount * CONTOUR_PARTICLE_RATIO,
      );
      const fillCount = particleCount - contourCount;

      type Sample = {
        x: number;
        y: number;
        rim: boolean;
        tone: ParticleTone;
      };
      const selected: Sample[] = [];

      // Contour: uniform by arc length along the linked outline paths,
      // with subpixel jitter — crisp edge, no double-pixel banding.
      if (totalLength > 0) {
        for (let index = 0; index < contourCount; index += 1) {
          let remaining = random() * totalLength;
          let pathIndex = outlinePaths.length - 1;
          for (let i = 0; i < outlinePaths.length; i += 1) {
            remaining -= pathLengths[i];
            if (remaining <= 0) {
              pathIndex = i;
              remaining += pathLengths[i];
              break;
            }
          }
          const path = outlinePaths[pathIndex];
          let x = path[path.length - 1].x;
          let y = path[path.length - 1].y;
          for (let i = 1; i < path.length; i += 1) {
            const leg = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
            if (remaining <= leg) {
              const t = leg > 0 ? remaining / leg : 0;
              x = path[i - 1].x + (path[i].x - path[i - 1].x) * t;
              y = path[i - 1].y + (path[i].y - path[i - 1].y) * t;
              break;
            }
            remaining -= leg;
          }
          x += (random() - 0.5) * 0.6;
          y += (random() - 0.5) * 0.6;
          selected.push({ x, y, rim: true, tone: toneAt(x, y) });
        }
      }

      // Fill: uniform rejection sampling over the surface (reference:
      // MeshSurfaceSampler), subpixel positions — no pixel-grid artefacts.
      let guard = fillCount * 60 + 100;
      while (
        selected.length < particleCount &&
        guard > 0
      ) {
        guard -= 1;
        const x = random() * (sw - 1);
        const y = random() * (sh - 1);
        if (alphaSmooth(x, y) < ISO) continue;
        selected.push({ x, y, rim: false, tone: toneAt(x, y) });
      }
      // Reference normalises the glyph to unit max-dimension, then fills
      // SIZE_FILL of the viewport's min dimension with the *ink*.
      const scale =
        (Math.min(width, height) * SIZE_FILL) / Math.max(inkW, inkH);
      logoWorldHeight = inkH * scale;
      faceDepth = logoWorldHeight * FACE_DEPTH_RATIO;
      // Reference cavity radius is ABSOLUTE: radius² 6084 → 78 world units
      // (strength 34, return 1-exp(-5.2dt) — all bundle-verified).
      cavityRadius = CAVITY_RADIUS;
      logoMaterial.uniforms.uLocalZExtent.value = 0.12;

      const spreadX = width * 0.92;
      const spreadY = height * 0.92;
      // Reference spawn z-band: ±(1.4 × Z_RANGE .12 × MULTIPLIER 2) = ±0.336
      // in normalized units → ×min dimension in world units. The deep z
      // spread is what makes the scattered cloud a volume, not a flat sheet.
      const spreadZ = 0.336 * Math.min(width, height);

      particles = selected.map((candidate) => {
        const anchorX = (candidate.x - inkCenterX) * scale;
        const anchorY = (inkCenterY - candidate.y) * scale;
        // Contour particles hug the lit front face only (reference verbatim:
        // rim depth ×0.12 over the front 12% band), fill particles take the
        // full slab thickness.
        const anchorZ = candidate.rim
          ? -random() * faceDepth * 0.12
          : -random() * faceDepth;
        return {
          anchorX,
          anchorY,
          anchorZ,
          spawnX: (random() - 0.5) * 2 * spreadX,
          spawnY: (random() - 0.5) * 2 * spreadY,
          spawnZ: (random() - 0.5) * 2 * spreadZ,
          x: 0,
          y: 0,
          z: 0,
          offX: 0,
          offY: 0,
          // Reference distribution verbatim: SIZE_MIN .1 / MAX 10,
          // baseSize = MIN + (MAX-MIN) × rand × 0.32 (small-weighted).
          size: 0.1 + random() * 9.9 * 0.32,
          depth: random(),
          phase: random() * Math.PI * 2,
          noisePhase: random() * Math.PI * 2,
          formDelay: 0,
          dissolveDelay: 0,
          dissolveEnd: 1,
          hasTwinkle: false,
          twinklePhase: random() * Math.PI * 2,
          twinkleSpeed: 0.85 + random() * 2.2,
          twinkle: 0.35 + random() * 0.65,
          tone: candidate.tone,
          rim: candidate.rim,
        };
      });

      // Distance-normalized formation delays (center→out, reference:
      // formDelay = distNorm × FORM_STAGGER). Dissolve uses a SPLIT-CREW
      // schedule instead of the reference's radial stagger (owner's
      // "备份轮廓" hypothesis, verified as the correct equivalent of the
      // reference's morph-then-dissolve two-stage flow):
      //  · rim particles are the SKELETON CREW — they hold the outline
      //    through the 180° landing, then peel in a fast 20° window
      //    (delay .30–.36, fully gone by dissolve .42 — RIM_DISSOLVE_END);
      //  · fill particles split into two departure waves (early .0–.25,
      //    late .3–.6, all done by dissolve 1) that spiral away in 3D —
      //    the density drop is real (particles leave), not an alpha
      //    trick, and the interior thins FIRST instead of the edges
      //    hollowing out.
      let maxDist = 1e-8;
      for (const particle of particles) {
        const dist = Math.hypot(particle.anchorX, particle.anchorY, particle.anchorZ);
        particle.formDelay = dist;
        maxDist = Math.max(maxDist, dist);
      }
      for (const particle of particles) {
        const distNorm = particle.formDelay / maxDist;
        particle.formDelay = distNorm * FORM_STAGGER;
        if (particle.rim) {
          particle.dissolveDelay =
            RIM_DISSOLVE_DELAY + random() * 0.06;
          particle.dissolveEnd = RIM_DISSOLVE_END;
        } else if (random() < 0.5) {
          particle.dissolveDelay = random() * 0.25; // first wave out
        } else {
          particle.dissolveDelay = 0.3 + random() * 0.3; // second wave
        }
      }

      // Twinkle assignment (reference: 35% of particles).
      const order = particles.map((_, index) => index);
      for (let index = order.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
      }
      const twinkleCount = Math.round(particles.length * TWINKLE_PERCENT);
      for (let index = 0; index < twinkleCount; index += 1) {
        particles[order[index]].hasTwinkle = true;
      }

      logoPositions = new Float32Array(particles.length * 3);
      logoSizes = new Float32Array(particles.length);
      logoBrightness = new Float32Array(particles.length);
      logoOpacity = new Float32Array(particles.length);
      logoGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(logoPositions, 3),
      );
      logoGeometry.setAttribute("size", new THREE.BufferAttribute(logoSizes, 1));
      logoGeometry.setAttribute(
        "brightness",
        new THREE.BufferAttribute(logoBrightness, 1),
      );
      logoGeometry.setAttribute(
        "opacity",
        new THREE.BufferAttribute(logoOpacity, 1),
      );
      const logoColors = new Float32Array(particles.length * 3);
      particles.forEach((particle, index) => {
        const [r, g, b] =
          particle.tone === "orange"
            ? particle.rim
              ? LOGO_ORANGE_RIM
              : LOGO_ORANGE
            : particle.rim
              ? LOGO_WHITE_RIM
              : LOGO_WHITE;
        logoColors[index * 3] = r;
        logoColors[index * 3 + 1] = g;
        logoColors[index * 3 + 2] = b;
      });
      logoGeometry.setAttribute("color", new THREE.BufferAttribute(logoColors, 3));

      // Debug hook: ?debugParticles exposes anchors/sizes for offline analysis.
      if (new URLSearchParams(window.location.search).has("debugParticles")) {
        (window as unknown as Record<string, unknown>).__logoDebug =
          particles.map((p) => [
            Math.round(p.anchorX * 10) / 10,
            Math.round(p.anchorY * 10) / 10,
            Math.round(p.size * 1000) / 1000,
            p.rim ? 1 : 0,
            p.tone,
          ]);
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      gl.setSize(width, height, false);
      composer.setSize(width, height);
      sceneTarget.setSize(width, height);
      trailRead.setSize(width, height);
      trailWrite.setSize(width, height);
      trailUniforms.u_resolution.value.set(width, height);
      trailUniforms.u_pointerRadius.value = 90 / Math.min(width, height);
      warpUniforms.u_resolution.value.set(width, height);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      monogramGroup.position.set(0, height * (0.5 - CENTER_Y_RATIO), 0);
      pointer.x = Math.min(pointer.x, width);
      pointer.y = Math.min(pointer.y, height);
      pointer.targetX = Math.min(pointer.targetX, width);
      pointer.targetY = Math.min(pointer.targetY, height);
      buildStars();
      if (logoReady) {
        const image = logoImageRef;
        if (image) buildParticles(image);
      }
    };

    let logoImageRef: HTMLImageElement | null = null;

    const debugParticles = new URLSearchParams(window.location.search).has(
      "debugParticles",
    );

    const update = (time: number, delta: number) => {
      const reduced = reducedMotionQuery.matches;
      lastDeltaSeconds = Math.min(delta, 50) / 1000;
      const pointerEase = 1 - Math.exp(-delta / 42);
      const prevX = pointer.x;
      const prevY = pointer.y;
      pointer.x += (pointer.targetX - pointer.x) * pointerEase;
      pointer.y += (pointer.targetY - pointer.y) * pointerEase;
      pointer.speed =
        (Math.hypot(pointer.x - prevX, pointer.y - prevY) / Math.max(delta, 1)) *
        1000;

      const progress = clamp01(progressRef.current ?? 0);
      const dissolve = clamp01(
        (progress - DISSOLVE_START) / (DISSOLVE_END - DISSOLVE_START),
      );
      // Owner's opening sequence: background/starfield first, the text
      // steps in at 0.3s, and the monogram starts converging only after
      // the text has landed (formationDelayMs from the gate).
      const elapsed = bornAt
        ? Math.max(0, time - bornAt - formationDelayMs)
        : 100000;
      const formation =
        reduced || introDone ? 1 : clamp01(elapsed / FORM_DURATION_MS);
      const timeSeconds = reduced ? 12 : time / 1000;
      const engaged =
        !reduced &&
        pointer.visible &&
        time - pointer.lastMove < 280 &&
        dissolve < 0.98;
      const speedNorm = Math.min(1, pointer.speed / 700);

      // Group look-tilt toward the pointer (reference: quaternion slerp),
      // composed with the scroll-driven sweep around the vertical axis.
      if (!reduced) {
        const nx = pointer.x / Math.max(width, 1) - 0.5;
        const ny = pointer.y / Math.max(height, 1) - 0.5;
        tiltDirection
          .set(-nx * GROUP_LOOK_TILT, ny * GROUP_LOOK_TILT, 1)
          .normalize();
        tiltTarget.setFromUnitVectors(tiltAxis, tiltDirection);
        tiltCurrent.slerp(
          tiltTarget,
          1 - Math.exp((-GROUP_TILT_SPEED * delta) / 1000),
        );
      }
      // 180° sweep around the vertical centerline (Y axis), from right to
      // left, linear with scroll (reference geometry scroll rotation runs
      // negative); scatter takes over for the second 90°.
      const ySpinT = clamp01(
        (progress - Y_SPIN_START) / (Y_SPIN_END - Y_SPIN_START),
      );
      ySpinQuat.setFromAxisAngle(ySpinAxis, -ySpinT * Y_SPIN_ANGLE);
      monogramGroup.quaternion.copy(tiltCurrent).multiply(ySpinQuat);

      // Cursor in monogram-local space (cavity rotates with the group).
      inverseTilt.copy(monogramGroup.quaternion).invert();
      localCursor
        .set(
          pointer.x - width / 2 - monogramGroup.position.x,
          height / 2 - pointer.y - monogramGroup.position.y,
          0,
        )
        .applyQuaternion(inverseTilt);

      const deltaSeconds = Math.min(delta, 50) / 1000;

      // --- Monogram particles ---
      const spinInComplete = formation >= 0.999;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];

        // Reference per-particle window: iT(delay,t) = (t-delay)/(1-delay) —
        // the stagger constant scales the DELAYS only; every particle
        // animates over its own [delay, 1] window, so all radii fade
        // gradually (silhouette thins but stays readable). Our previous
        // uniform-window form t*(1+S)-delay swept a hard edge inward,
        // collapsing the visible remainder into a dense core.
        const formT = easeOutCubic(
          clamp01(
            (formation - particle.formDelay) /
              Math.max(1e-6, 1 - particle.formDelay),
          ),
        );
        let x = particle.spawnX + (particle.anchorX - particle.spawnX) * formT;
        let y = particle.spawnY + (particle.anchorY - particle.spawnY) * formT;
        let z = particle.spawnZ + (particle.anchorZ - particle.spawnZ) * formT;
        if (!spinInComplete) {
          const spun = rotateY(x, z, formT * FORM_SPIN);
          x = spun.x;
          z = spun.z;
        }

        // Reference alignment: the monogram is pinned to its anchors and only
        // twinkles in brightness — ricardochance's bundle ships drift code but
        // clamps it to zero (FOOTER_R_PARTICLE_OFFSET_MAX = 0). No idle drift.

        // Reference form stage: S=n, R=n — opacity and size scale with the
        // per-particle formation easing, so the monogram materialises as a
        // fading-in/thickening cloud, not a full-strength swarm flying
        // across the screen. Brightness base (1.05) is NOT scaled by the
        // reference; only twinkle amplitude is (kept as-is here).
        let alpha = formT;
        let sizeMul = formT;
        let twinkleMul = 1;
        if (dissolve > 0) {
          const local = clamp01(
            (dissolve - particle.dissolveDelay) /
              Math.max(1e-6, particle.dissolveEnd - particle.dissolveDelay),
          );
          if (local > 0) {
            // Reference hero-morph dissolve, verbatim (bundle-verified):
            // each particle travels toward its spawn point while rotating
            // e×360° around Y — the spiral trajectory is what gives the
            // cloud its 3D volume — while opacity, size AND twinkle
            // amplitude decay (S=1-e, R=1-e, w=1-.85e). The shrinking
            // grain reads as particles receding into space. Radial
            // stagger (extremities first) combined with the group's fast
            // spin paints spiral arms instead of hollowing the slab.
            const eased = easeOutCubic(local);
            x += (particle.spawnX - x) * eased;
            y += (particle.spawnY - y) * eased;
            z += (particle.spawnZ - z) * eased;
            const spun = rotateY(x, z, eased * DISSOLVE_ROTATION);
            x = spun.x;
            z = spun.z;
            alpha *= 1 - eased;
            sizeMul *= 1 - eased;
            twinkleMul = 1 - 0.85 * eased;
          }
        }

        // Cylindrical cavity: repel in group-local space so the tunnel
        // tilts with the monogram (reference: radius²=6084, strength 34).
        const decay = 1 - Math.exp(-CAVITY_RETURN * deltaSeconds);
        particle.offX -= particle.offX * decay;
        particle.offY -= particle.offY * decay;
        if (engaged && formT >= 1) {
          const px = x + particle.offX;
          const py = y + particle.offY;
          const dx = px - localCursor.x;
          const dy = py - localCursor.y;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq < cavityRadius * cavityRadius) {
            const distance = Math.sqrt(distanceSq) || 1e-4;
            const influence = 1 - distance / cavityRadius;
            const impulse =
              influence *
              influence *
              CAVITY_STRENGTH *
              speedNorm *
              deltaSeconds *
              60;
            particle.offX += (dx / distance) * impulse;
            particle.offY += (dy / distance) * impulse;
          }
        }

        logoPositions[index * 3] = x + particle.offX;
        logoPositions[index * 3 + 1] = y + particle.offY;
        logoPositions[index * 3 + 2] = z;

        // Twinkle (reference high tier: 2.6-power curve × 3.5 for 40%).
        let brightness = 1.05;
        if (particle.hasTwinkle) {
          const r = timeSeconds * particle.twinkleSpeed + particle.twinklePhase;
          const wave =
            (0.5 * Math.sin(r) +
              0.32 * Math.sin(2.17 * r + particle.phase) +
              0.18 * Math.sin(4.83 * r + particle.noisePhase) +
              1) *
            0.5;
          brightness += Math.pow(Math.max(0, wave), 2.6) * TWINKLE_INTENSITY;
        } else {
          brightness +=
            0.1 * Math.sin(timeSeconds * (1.1 + particle.twinkle) + particle.phase);
        }
        logoBrightness[index] = brightness * twinkleMul;
        logoOpacity[index] = alpha;
        logoSizes[index] = particle.size * sizeMul;
      }
      logoGeometry.attributes.position.needsUpdate = true;
      logoGeometry.attributes.size.needsUpdate = true;
      logoGeometry.attributes.brightness.needsUpdate = true;
      logoGeometry.attributes.opacity.needsUpdate = true;

      // Debug hook: ?debugParticles exposes the scrub state so probes can
      // park the dissolve at an exact phase for A/B screenshots.
      if (debugParticles) {
        (window as unknown as Record<string, unknown>).__launchState = {
          progress,
          dissolve,
          formation,
        };
      }

      // --- Warp starfield ---
      // Reference: star speed ×= scrollBoost — particleDownSpeed 8 /
      // particleUpSpeed 0.2, rw()-eased. There is NO dissolve-based boost:
      // fast scrubbing IS the warp (down 8×), scrolling up crawls (0.2×).
      const progressDelta = progress - lastProgress;
      const starBoostTarget =
        progressDelta > 0.0004 ? 8 : progressDelta < -0.0004 ? 0.2 : 1;
      starBoost = rwEase(starBoost, starBoostTarget, 0.2, deltaSeconds);
      const starRandom = Math.random;
      for (let index = 0; index < stars.length; index += 1) {
        const star = stars[index];
        if (!reduced) {
          star.z += star.speed * starBoost * deltaSeconds;
          if (star.z > STAR_DESPAWN_Z) {
            Object.assign(star, spawnStar(starRandom, false));
            star.offX = 0;
            star.offY = 0;
            star.speed = 40 * Math.pow(520 / 40, starRandom());
          }
        }

        if (engaged) {
          // Reference: depth ratio |z|/450 with NO clamp — far stars get a
          // huge influence radius (up to ~5.3× at the spawn plane).
          const depthRatio = Math.abs(star.z) / STAR_CURSOR_DEPTH_REF;
          const radius = STAR_CURSOR_RADIUS * depthRatio;
          const halfH = STAR_FOV_TAN * Math.abs(star.z);
          const worldScale = halfH / Math.max(height * 0.5, 1);
          const px = (pointer.x - width * 0.5) * worldScale;
          const py = (pointer.y - height * 0.5) * worldScale;
          const dx = star.x + star.offX - px;
          const dy = star.y + star.offY - py;
          const distance = Math.max(1, Math.hypot(dx, dy));
          if (distance < radius) {
            const influence = 1 - distance / radius;
            const impulse =
              influence *
              influence *
              STAR_BULGE *
              speedNorm *
              depthRatio *
              deltaSeconds *
              4;
            star.offX += (dx / distance) * impulse;
            star.offY += (dy / distance) * impulse;
          }
        }
        const starReturn = Math.exp(-STAR_RETURN * deltaSeconds);
        star.offX *= starReturn;
        star.offY *= starReturn;

        const absZ = Math.max(Math.abs(star.z), 1);
        const projection = (height * 0.5) / (STAR_FOV_TAN * absZ);
        const screenX = width * 0.5 + (star.x + star.offX) * projection;
        const screenY = height * 0.5 + (star.y + star.offY) * projection;
        starPositions[index * 3] = screenX - width * 0.5;
        starPositions[index * 3 + 1] = height * 0.5 - screenY;
        starPositions[index * 3 + 2] = 0;

        // Reference star curves verbatim:
        // size = baseSize × 520/depth clamped to 56px (despawn z=80 bounds
        // the max, so close stars become large soft orbs); brightness =
        // level × clamp(1 + z/spawnFarMax, 0.2, 1) — stars brighten as they
        // fly past the camera plane, no per-star twinkle.
        const approach = STAR_SIZE_REF / absZ;
        starBrightness[index] =
          star.brightness *
          Math.min(1, Math.max(0.2, 1 + star.z / STAR_FAR_MAX));
        // Reference has no dissolve-linked star fade.
        starOpacity[index] = 1;
        starSizes[index] = Math.min(56, star.baseSize * approach);
      }
      starGeometry.attributes.position.needsUpdate = true;
      starGeometry.attributes.size.needsUpdate = true;
      starGeometry.attributes.brightness.needsUpdate = true;
      starGeometry.attributes.opacity.needsUpdate = true;

      // Background driver: time advances continuously, scroll speed boosts it
      // (reference: scrollGradientBoost — down 1.8×, up 0.3×, rw()-eased).
      if (reduced) {
        bgUniforms.uTime.value = 40;
      } else {
        const boostTarget =
          progressDelta > 0.0004 ? 1.8 : progressDelta < -0.0004 ? 0.3 : 1;
        scrollBoost = rwEase(scrollBoost, boostTarget, 0.3, deltaSeconds);
        bgUniforms.uTime.value += deltaSeconds * scrollBoost;
      }
      lastProgress = progress;

      // --- Trail state machine (reference useFrame block, verbatim rates) ---
      // engagement ticker: raw client-pixel speed, min(speed/5, 1) target.
      const moveDelta = Math.hypot(trail.px - trail.prevPx, trail.py - trail.prevPy);
      trail.speed += (moveDelta - trail.speed) * 0.5;
      if (trail.speed < 0.001) trail.speed = 0;
      trail.prevPx = trail.px;
      trail.prevPy = trail.py;
      const engageTarget = Math.min(trail.speed / 5, 1);
      trail.engagement += (engageTarget - trail.engagement) * 0.06;
      if (trail.engagement < 0.001) trail.engagement = 0;

      // uvSmooth follows uv at rate 9/s.
      trail.uvSmoothPrev.x = trail.uvSmooth.x;
      trail.uvSmoothPrev.y = trail.uvSmooth.y;
      const smoothEase = 1 - Math.exp(-9 * deltaSeconds);
      trail.uvSmooth.x += (trail.uv.x - trail.uvSmooth.x) * smoothEase;
      trail.uvSmooth.y += (trail.uv.y - trail.uvSmooth.y) * smoothEase;

      // vfxEngage: fast rise (11/s), slow release (2.2/s) once the pointer
      // settles; disengageProgress drives the trail's tail-first retraction.
      const lagX = trail.uv.x - trail.uvSmooth.x;
      const lagY = trail.uv.y - trail.uvSmooth.y;
      const lag = Math.hypot(lagX, lagY);
      let vfxTarget = trail.engagement;
      if (lag > 0.0025) {
        vfxTarget = Math.max(vfxTarget, Math.min(0.35 + 28 * lag, 1));
      }
      const vfxRate =
        lag <= 0.0025 && trail.engagement < 0.03 ? 2.2 : 11;
      trail.vfxEngage +=
        (vfxTarget - trail.vfxEngage) * (1 - Math.exp(-vfxRate * deltaSeconds));
      if (trail.vfxEngage < 0.008) trail.vfxEngage = 0;
      if (trail.vfxEngage > 0.008) {
        trail.disengageProgress = 0;
      } else {
        trail.disengageProgress = Math.min(
          trail.disengageProgress + 1.35 * deltaSeconds,
          1.5,
        );
      }
      trail.active =
        trail.vfxEngage > 0.02 ||
        trail.disengageProgress > 0.02 ||
        trail.engagement > 0.02;
    };

    const render = () => {
      const dt = lastDeltaSeconds;

      // (1) Trail ping-pong update — only while the pointer is active or the
      // trail is still retracting (reference gate: vfxEngage/disengage/
      // engagement > 0.02).
      if (trail.active) {
        trailUniforms.u_trailPrev.value = trailRead.texture;
        trailUniforms.u_pointer.value.set(trail.uvSmooth.x, trail.uvSmooth.y);
        trailUniforms.u_pointerPrev.value.set(
          trail.uvSmoothPrev.x,
          trail.uvSmoothPrev.y,
        );
        trailUniforms.u_pointerEngage.value = trail.vfxEngage;
        trailUniforms.u_fade.value = Math.pow(0.968, 60 * dt);
        trailUniforms.u_disengage.value = trail.disengageProgress;
        trailUniforms.u_ageRate.value = 0.018 * dt * 60;
        trailUniforms.u_time.value += dt;
        gl.setRenderTarget(trailWrite);
        gl.setClearColor(0, 0);
        gl.clear();
        gl.render(trailScene, bgCamera);
        const swap = trailRead;
        trailRead = trailWrite;
        trailWrite = swap;
        warpUniforms.u_trail.value = trailRead.texture;
      }
      warpUniforms.u_time.value += dt;
      warpUniforms.u_pointerEngage.value = trail.vfxEngage;

      // (2) Background + stars into the scene target (CSS resolution, like
      // the reference's fboScale=1; the composite upsamples).
      gl.setRenderTarget(sceneTarget);
      gl.setClearColor(0, 0);
      gl.clear();
      gl.render(bgScene, bgCamera);
      gl.clearDepth();
      gl.autoClear = false;
      gl.render(scene, camera);
      gl.autoClear = true;
      gl.setRenderTarget(null);

      // (3) Warp composite + bloom via the composer.
      composer.render();

      // (4) Monogram drawn on top, unbloomed — mirrors the reference's
      // separate rig canvas stacked over the background canvas.
      gl.autoClear = false;
      gl.render(logoScene, camera);
      gl.autoClear = true;
    };

    const updateCursor = (delta: number) => {
      // Dot follows instantly; ring trails with the hero spring.
      cursorDot.style.transform = `translate3d(${pointer.targetX}px, ${pointer.targetY}px, 0)`;
      const stiffness = 520 / 0.45;
      const damping = 42 / 0.45;
      const step = Math.min(delta, 34) / 1000;
      ring.vx +=
        (-(ring.x - pointer.targetX) * stiffness - ring.vx * damping) * step;
      ring.vy +=
        (-(ring.y - pointer.targetY) * stiffness - ring.vy * damping) * step;
      ring.x += ring.vx * step;
      ring.y += ring.vy * step;
      cursorRing.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;

      const visible = pointer.visible && pointer.pointerType !== "touch";
      cursorDot.style.opacity = visible ? "1" : "0";
      cursorRing.style.opacity = visible ? "1" : "0";
    };

    const animate = (time: number) => {
      frame = null;
      if (disposed) return; // zombie loop from a cleaned-up mount: stop
      if (!isDocumentVisible || isFrozenRef.current) return;
      if (!bornAt) bornAt = time;
      const delta = lastTime ? Math.min(34, time - lastTime) : 16.667;
      lastTime = time;
      // Heartbeat for probes/diagnostics: if this stops growing while the
      // gate is visible, the render loop died (the "no stars, no cursor"
      // report). Read as window.__launchFrames.
      (window as unknown as Record<string, unknown>).__launchFrames =
        ((window as unknown as Record<string, number>).__launchFrames || 0) +
        1;
      // While the tile grid fully covers the gate the canvas is CSS-hidden:
      // skip the whole particle update + WebGL render (the expensive part)
      // and keep only the cursor spring. Formation uses absolute time, so
      // skipping update has no side effects on the timeline.
      const gateTileT = clamp01(
        ((progressRef.current ?? 0) - GATE_TILE_START) / GATE_TILE_SPAN,
      );
      try {
        if (gateTileT <= GATE_COVERED_T) {
          update(time, delta);
          render();
        } else if (debugParticles) {
          // update() is skipped while covered, but probes still park on
          // __launchState.progress — keep the hook alive from the raw ref.
          (window as unknown as Record<string, unknown>).__launchState = {
            progress: clamp01(progressRef.current ?? 0),
            dissolve: 1,
            formation: 1,
          };
        }
        updateCursor(delta);
        frameErrors = 0;
      } catch (error) {
        // A single bad frame must NEVER kill the loop silently — that
        // failure class reads exactly as "stars and cursor froze after a
        // refresh". Skip the frame and keep animating; only a sustained
        // failure (~2s of consecutive bad frames) parks the rAF.
        frameErrors += 1;
        if (frameErrors === 1 || frameErrors % 30 === 0) {
          console.warn(`[launch] bad frame ×${frameErrors}`, error);
        }
        if (frameErrors >= 120) {
          console.error(
            "[launch] 120 consecutive bad frames — render loop parked",
            error,
          );
          return;
        }
      }
      frame = window.requestAnimationFrame(animate);
    };

    const cancelFrame = () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    };
    cancelFrameRef.current = cancelFrame;

    const ensureAnimation = () => {
      if (disposed) return;
      if (frame === null && isDocumentVisible && !isFrozenRef.current) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    // Cursor feedback must not wait for the render loop — update the dot
    // right in the event handler so the very first mouse move shows it.
    const showCursor = () => {
      cursorDot.style.transform = `translate3d(${pointer.targetX}px, ${pointer.targetY}px, 0)`;
      if (pointer.visible && pointer.pointerType !== "touch") {
        cursorDot.style.opacity = "1";
        cursorRing.style.opacity = "1";
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.visible = true;
      pointer.pointerType = event.pointerType;
      pointer.lastMove = performance.now();
      // Trail input (reference rT): raw uv with flipped y, velocity smoothed
      // per event; the per-frame machine below does the rest.
      const bounds = canvas.getBoundingClientRect();
      trail.uvPrev.x = trail.uv.x;
      trail.uvPrev.y = trail.uv.y;
      trail.uv.x = (event.clientX - bounds.left) / Math.max(bounds.width, 1);
      trail.uv.y = 1 - (event.clientY - bounds.top) / Math.max(bounds.height, 1);
      trail.px = event.clientX;
      trail.py = event.clientY;
      showCursor();
    };

    const handlePointerDown = (event: PointerEvent) => {
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.visible = true;
      pointer.dragging = true;
      pointer.pointerType = event.pointerType;
      pointer.lastMove = performance.now();
      showCursor();
    };

    const handlePointerUp = () => {
      pointer.dragging = false;
    };

    const handlePointerLeave = () => {
      if (!pointer.dragging) {
        pointer.visible = false;
        cursorDot.style.opacity = "0";
        cursorRing.style.opacity = "0";
      }
    };

    const handleVisibility = () => {
      if (disposed) return;
      isDocumentVisible = !document.hidden;
      if (!isDocumentVisible) {
        cancelFrame();
      } else {
        lastTime = 0;
        ensureAnimation();
      }
    };

    const logoImage = new Image();
    logoImage.addEventListener("load", () => {
      if (disposed) return; // cleaned-up mount's late image: ignore
      logoReady = true;
      logoImageRef = logoImage;
      buildParticles(logoImage);
      render();
      ensureAnimation();
    });
    logoImage.addEventListener("error", () => {
      if (disposed) return;
      // A hung/failed monogram PNG must not freeze the field — retry the
      // asset once with a cache-buster; the scene runs regardless.
      console.warn("[launch] monogram image failed — retrying with cache-buster");
      window.setTimeout(() => {
        if (disposed) return;
        logoImage.src = `/media/wenzo-logo-hd.png?retry=${Date.now()}`;
      }, 1500);
    });
    logoImage.src = "/media/wenzo-logo-hd.png";

    // Boot the scene IMMEDIATELY: stars/background/cursor must not wait on
    // the monogram image. Previously the first render AND the rAF loop
    // were only kicked from the image's load event, so a slow or failed
    // request left the whole field dark — the "stars missing on refresh"
    // half of the reported bug.
    resize();
    render();
    ensureAnimation();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("blur", handlePointerUp);
    document.documentElement.addEventListener(
      "pointerleave",
      handlePointerLeave,
    );
    document.addEventListener("visibilitychange", handleVisibility);
    // GPU reset mid-session (driver crash / process reclamation): prevent
    // the default dead-canvas behaviour and reboot on a fresh element
    // (the clone at the top of the effect runs on the retry pass).
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (disposed) return;
      console.warn("[launch] WebGL context lost — rebooting on a fresh canvas");
      cancelFrame();
      setWebglDead(true); // fallback cursor covers the reboot window
      if (webglRetry < 8) {
        window.setTimeout(() => setWebglRetry((n) => n + 1), 700);
      }
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    console.info(
      `[launch] particle field booted (retry ${webglRetry}, dpr ${pixelRatio})`,
    );

    return () => {
      disposed = true; // silence every async entry point BEFORE disposing
      cancelFrame();
      cancelFrameRef.current = null;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("blur", handlePointerUp);
      document.documentElement.removeEventListener(
        "pointerleave",
        handlePointerLeave,
      );
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);

      // Explicitly release GPU/CPU resources instead of waiting for GC.
      particles = [];
      stars = [];
      starGeometry.dispose();
      logoGeometry.dispose();
      starMaterial.dispose();
      logoMaterial.dispose();
      sceneTarget.dispose();
      trailRead.dispose();
      trailWrite.dispose();
      trailMaterial.dispose();
      warpMaterial.dispose();
      composer.dispose();
      gl.dispose();
    };
    } catch (error) {
      // Synchronous boot failure AFTER the renderer came up (composer/FBO/
      // shader on a cold GPU process). Same contract as the construction
      // catch above: the webglDead-owned fallback keeps the cursor alive,
      // and the retry reboots on a FRESH canvas element (see the clone at
      // the top of the effect).
      console.error(
        `[launch] scene boot failed after renderer came up (retry ${webglRetry})`,
        error,
      );
      try {
        gl.dispose();
      } catch {
        // already torn down
      }
      setWebglDead(true);
      let retryTimer: number | null = null;
      if (webglRetry < 8) {
        retryTimer = window.setTimeout(
          () => setWebglRetry((n) => n + 1),
          700,
        );
      }
      return () => {
        if (retryTimer !== null) window.clearTimeout(retryTimer);
      };
    }
  }, [introDone, formationDelayMs, progressRef, webglRetry]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="launch-gate__canvas"
        aria-hidden="true"
      />
      <div
        ref={cursorRingRef}
        className="launch-gate__cursor launch-gate__cursor--ring"
        aria-hidden="true"
      >
        <span />
      </div>
      <div
        ref={cursorDotRef}
        className="launch-gate__cursor launch-gate__cursor--dot"
        aria-hidden="true"
      >
        <span />
      </div>
    </>
  );
}
