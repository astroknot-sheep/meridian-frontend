import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Meridian — flowing gradient background.
 *
 * Technique (the same family used on Stripe / Luma / design-forward landing
 * pages, adapted to Meridian's warm paper-and-gold palette):
 *   1. Layered simplex "waves" at several scales, drifting in opposite
 *      directions with a deliberately subtle directional flow.
 *   2. Each band carries its own slow "lightness field"; bands are blended
 *      with a signed-distance alpha that is softened by a quintic smoothstep
 *      (this is what produces the long, silky, variable-blur edges).
 *   3. The final lightness is mapped through a 5-stop warm colour ramp, so
 *      the field breathes between cream, sand and soft gold rather than
 *      flat-shading a single hue.
 *   4. A faint diagonal orientation + an animated film-grain & dither pass
 *      kill banding and give the "designed, not generated" texture.
 *
 * Craft details: a ~10s breathing cycle (calming, on-theme), a cursor warm-
 * pool that idles into an autonomous drift, reduced-motion support, and a
 * tab-visibility pause to stay light on the GPU.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;

  // ── Ashima 2D simplex noise ───────────────────────────────
  vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x  = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Cheap hash for grain / dither.
  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Quintic smoothstep (iq) — softer than the built-in.
  float qstep(float t){ return t * t * t * (t * (6.0 * t - 15.0) + 10.0); }

  // ── Wave shape: stacked simplex with subtle directional flow ──
  float flowField(vec2 uv, float offset){
    float t = uTime * 0.060;            // slow, meditative
    float F = 0.05;                     // flow is felt, never seen
    float n = 0.0;
    n += snoise(vec2(uv.x * 2.4 + F * 1.0 * t + offset,        uv.y * 1.2 + t * 0.12)) * 0.55;
    n += snoise(vec2(uv.x * 4.1 - F * 0.6 * t + offset * 1.3,  uv.y * 1.0 - t * 0.16)) * 0.30;
    n += snoise(vec2(uv.x * 7.0 + F * 0.8 * t + offset * 0.7,  uv.y * 0.8 + t * 0.09)) * 0.16;
    return n;                           // ~ -1..1
  }

  // ── Lightness field: large sweeping fades that map to colour ──
  float lightField(vec2 uv, float offset){
    float t = uTime * 0.050;
    float F = 0.07;
    float n = 0.5;
    n += snoise(vec2(uv.x * 1.6 + F * 1.0 * t + offset,        uv.y * 3.0)) * 0.30;
    n += snoise(vec2(uv.x * 1.0 - F * 0.6 * t + offset * 1.7,  uv.y * 2.4)) * 0.26;
    n += snoise(vec2(uv.x * 0.6 + F * 0.8 * t + offset * 0.4,  uv.y * 1.8)) * 0.22;
    return clamp(n, 0.0, 1.0);
  }

  // ── One soft band, blended by signed distance + dynamic blur ──
  float waveAlpha(vec2 uv, float baseY, float amp, float offset){
    float wy   = baseY + flowField(uv, offset) * amp;
    float dist = wy - uv.y;                         // in uv units
    float bn   = snoise(vec2(uv.x * 3.0 + uTime * 0.05 + offset, uTime * 0.04));
    float bt   = pow((bn + 1.0) * 0.5, 5.0);        // bias toward "sharp"
    float blur = mix(0.012, 0.16, bt);              // periods of crisp / hazy
    float a    = clamp(0.5 + dist / blur, 0.0, 1.0);
    return qstep(a);
  }

  // ── 5-stop warm ramp: troughs warm, mid cream-bright, peaks gold ──
  vec3 calcColor(float t){
    vec3 c1 = vec3(0.700, 0.580, 0.490);  // warm taupe (shadow)
    vec3 c2 = vec3(0.918, 0.882, 0.835);  // sand
    vec3 c3 = vec3(0.965, 0.953, 0.937);  // cream (brightest)
    vec3 c4 = vec3(0.792, 0.690, 0.533);  // gold
    vec3 c5 = vec3(0.745, 0.564, 0.447);  // soft amber (glow)
    float N = 4.0;
    vec3 c = c1;
    c = mix(c, c2, clamp((t - 0.0 / N) * N, 0.0, 1.0));
    c = mix(c, c3, clamp((t - 1.0 / N) * N, 0.0, 1.0));
    c = mix(c, c4, clamp((t - 2.0 / N) * N, 0.0, 1.0));
    c = mix(c, c5, clamp((t - 3.0 / N) * N, 0.0, 1.0));
    return c;
  }

  void main(){
    vec2  uv     = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    float breathe = 0.5 + 0.5 * sin(uTime * 0.16);   // ~10s calming cycle

    // Faint diagonal orientation (sampling-space only → no edge gaps).
    float ang = -0.10;
    mat2  R   = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    vec2  suv = (uv - 0.5);  suv.x *= aspect;
    suv = R * suv;           suv.x /= aspect;
    suv += 0.5;

    // Three lightness fields, blended through two drifting bands.
    float bg = lightField(suv,   0.0);
    float l1 = lightField(suv,  60.0);
    float l2 = lightField(suv, 130.0);
    float a1 = waveAlpha (suv, 0.68, 0.16,  17.0);
    float a2 = waveAlpha (suv, 0.34, 0.20,  73.0);

    float L = bg;
    L = mix(L, l1, a1);
    L = mix(L, l2, a2);

    vec3 col = calcColor(clamp(L, 0.0, 1.0));

    // Keep the upper area airy so hero text always reads cleanly.
    col = mix(col, vec3(0.965, 0.953, 0.937), smoothstep(0.55, 1.0, uv.y) * 0.16);

    // Cursor warm-pool — a soft pour of light that follows you.
    vec2  d  = uv - uMouse;  d.x *= aspect;
    float mp = smoothstep(0.50, 0.0, length(d));
    col = mix(col, vec3(0.808, 0.706, 0.545), mp * 0.10);
    col += vec3(0.055, 0.042, 0.024) * mp * (0.6 + 0.4 * breathe);

    // Gentle bloom on the brightest crests, modulated by the breath.
    col += vec3(0.04, 0.034, 0.022) * pow(clamp(L, 0.0, 1.0), 3.0) * (0.5 + 0.5 * breathe);

    // Warm, soft vignette (never crushes to black).
    float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(aspect, 1.0)));
    col *= mix(0.955, 1.0, vig);

    // Animated film grain + 8-bit dither — the premium, non-generated finish.
    float grain = hash21(gl_FragCoord.xy + fract(uTime) * 131.0);
    col += (grain - 0.5) * 0.024;
    col += (hash21(gl_FragCoord.xy * 0.37 + 11.0) - 0.5) / 255.0;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse =
      window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      // No WebGL → leave the canvas blank; the page background shows through.
      return;
    }

    const dprCap = coarse ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xf5f2ee, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uMouse: { value: new THREE.Vector2(0.5, 0.62) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Pointer state (eased) + autonomous idle drift.
    const pointer = { x: 0.5, y: 0.62 };
    const target = { x: 0.5, y: 0.62 };
    let lastMove = -100;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    let running = true;

    const onMove = (e) => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      target.x = cx / window.innerWidth;
      target.y = 1.0 - cy / window.innerHeight;
      lastMove = elapsed;
    };
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };
    const onVisibility = () => {
      const wasRunning = running;
      running = !document.hidden;
      if (running && !wasRunning) {
        last = performance.now();
        raf = requestAnimationFrame(animate);
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    const speed = reduceMotion ? 0.12 : 1.0;
    const ease = reduceMotion ? 0.012 : 0.035;

    function animate(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt * speed;
      uniforms.uTime.value = elapsed;

      // After a few idle seconds, let the light drift on a slow path so the
      // background still feels alive on touch devices / when the mouse rests.
      if (elapsed - lastMove > 2.5) {
        const a = elapsed * 0.06;
        target.x = 0.5 + Math.cos(a) * 0.22;
        target.y = 0.6 + Math.sin(a * 0.8) * 0.16;
      }
      pointer.x += (target.x - pointer.x) * ease;
      pointer.y += (target.y - pointer.y) * ease;
      uniforms.uMouse.value.set(pointer.x, pointer.y);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}