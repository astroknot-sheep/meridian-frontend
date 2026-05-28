import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ─────────────────────────────────────────
   PREMIUM AI STARTUP BACKGROUND SHADER
   Upgrades: ACES tone mapping, film grain,
   barrel distortion, velocity-reactive fluid,
   scroll time dilation, section morphing,
   dark mode, anisotropic vignette, performance
   guards (IntersectionObserver, visibility,
   reduced motion, delta time, dynamic DPR).
   ───────────────────────────────────────── */

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
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform vec2 uMouseVel;
  uniform float uScrollY;
  uniform float uScrollVel;
  uniform float uSection;        // 0.0 = hero (warm), 1.0 = deep (cool)
  uniform float uDarkMode;       // 0.0 = light, 1.0 = dark
  uniform float uReducedMotion;  // 0.0 = full motion, 1.0 = frozen

  // ── Simplex noise (unchanged core) ──
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                            dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x  = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float f = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 5; i++) {
      f += amp * snoise(p * freq);
      freq *= 2.1;
      amp  *= 0.48;
    }
    return f;
  }

  // ── Utilities ──

  // ACES Filmic Tone Mapping (approximation)
  vec3 acesFilmic(vec3 x) {
    float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  // Gamma-correct mix (cheap perceptual blend)
  vec3 mixLinear(vec3 a, vec3 b, float t) {
    vec3 a2 = a * a;   // approx gamma-2
    vec3 b2 = b * b;
    return sqrt(mix(a2, b2, t));
  }

  // 35mm-style animated grain
  float filmGrain(vec2 uv, float time) {
    float n = fract(sin(dot(uv + fract(time * vec2(0.13, 0.73)),
                              vec2(12.9898, 78.233))) * 43758.5453);
    return (n - 0.5) * 0.035;
  }

  // Subtle barrel lens distortion
  vec2 barrel(vec2 uv, float k) {
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    return uv + c * r2 * k;
  }

  // Anisotropic vignette with organic feather
  float vignette(vec2 uv, vec2 mouse) {
    vec2 off = (mouse - 0.5) * 0.06;
    vec2 p = uv - 0.5 - off;
    p.x *= 1.18;                 // elliptical
    float v = 1.0 - dot(p, p) * 1.35;
    return smoothstep(0.0, 1.0, v);
  }

  void main() {
    vec2 uv = vUv;

    // 1. Lens distortion
    uv = barrel(uv, 0.012);

    // 2. Velocity fluid warp (cursor leaves a wake)
    vec2 vel = uMouseVel;
    float velMag = length(vel);
    float wake = smoothstep(0.5, 0.0, length(vUv - uMouse));
    uv += vel * 0.18 * wake;

    // 3. Time with scroll dilation & reduced-motion guard
    float timeScale = 0.12 * (1.0 + abs(uScrollVel) * 3.0);
    float t = uTime * timeScale * (1.0 - uReducedMotion);

    // 4. Domain-warped FBM (original structure)
    vec2 q = vec2(
      fbm(uv * 2.4 + vec2(t * 0.2, t * -0.12)),
      fbm(uv * 2.4 + vec2(t * 0.25, t * 0.15))
    );
    vec2 r = vec2(
      fbm(uv * 2.8 + q * 1.2 + vec2(t * 0.5, t * 0.2)),
      fbm(uv * 2.8 + q * 1.2 - vec2(t * 0.28, t * 0.38))
    );
    float flow = fbm(uv * 1.8 + r);

    // 5. Mouse glow (enhanced)
    float mouseDist = length(vUv - uMouse);
    float mouseGlow = smoothstep(0.48, 0.0, mouseDist) * 0.22;

    // 6. Hover-reactive grid
    float gridX = abs(sin((uv.x + q.x * 0.3) * 14.0));
    float gridY = abs(sin((uv.y + q.y * 0.3) * 14.0));
    float grid = smoothstep(0.85, 1.0, gridX) + smoothstep(0.85, 1.0, gridY);
    grid *= 0.1 * (1.0 - abs(flow) * 0.5);
    grid += mouseGlow * 0.35 * smoothstep(0.85, 1.0, gridX + gridY);

    // 7. Palettes ── Light vs Dark
    vec3 bgLight      = vec3(0.961, 0.949, 0.933);
    vec3 creamLight   = vec3(0.935, 0.905, 0.865);
    vec3 goldLight    = vec3(0.77,  0.66,  0.51);
    vec3 amberLight   = vec3(0.72,  0.53,  0.42);

    vec3 bgDark       = vec3(0.035, 0.035, 0.04);
    vec3 creamDark    = vec3(0.055, 0.055, 0.06);
    vec3 goldDark     = vec3(0.30,  0.24,  0.16);
    vec3 amberDark    = vec3(0.20,  0.15,  0.11);

    vec3 bgColor    = mix(bgLight,    bgDark,    uDarkMode);
    vec3 warmCream  = mix(creamLight, creamDark, uDarkMode);
    vec3 warmGold   = mix(goldLight,  goldDark,  uDarkMode);
    vec3 softAmber  = mix(amberLight, amberDark, uDarkMode);

    // Cool "tech" accent for section morphing
    vec3 coolLight    = vec3(0.88, 0.91, 0.94);
    vec3 coolDark     = vec3(0.08, 0.10, 0.13);
    vec3 coolTech     = mix(coolLight, coolDark, uDarkMode);

    // 8. Base gradient
    float grad = uv.y * 0.6 + flow * 0.4;
    vec3 base = mixLinear(bgColor, warmCream, grad);

    // 9. Temperature shift: cool near cursor (attention spotlight)
    float temp = smoothstep(0.45, 0.0, mouseDist) * 0.12 * (1.0 - uDarkMode * 0.5);
    base = mixLinear(base, coolTech, temp);

    // 10. Flow color layers
    float mixIntensity = 0.42 + mouseGlow;
    base = mixLinear(base, warmGold, flow * mixIntensity * 0.5 + 0.03);
    base = mixLinear(base, softAmber, max(flow * 0.15, 0.0));
    base = mixLinear(base, warmGold, mouseGlow * 0.6);
    base += grid * warmGold * 0.35;

    // 11. Section narrative morph (0 = warm organic, 1 = cool structured)
    base = mixLinear(base, mixLinear(base, coolTech, 0.22), uSection * 0.35);

    // 12. Anisotropic vignette
    float vig = vignette(vUv, uMouse);
    base = mixLinear(bgColor, base, vig);

    // 13. Film grain (less in dark mode to avoid noise-banding)
    base += filmGrain(vUv, uTime) * (1.0 - uDarkMode * 0.6);

    // 14. ACES tone mapping (cinematic highlight roll-off)
    base = acesFilmic(base);

    // 15. Subtle edge CA tint (cheap fake chromatic aberration)
    float edge = smoothstep(0.3, 0.55, length(vUv - 0.5));
    base.r += edge * 0.018;
    base.b -= edge * 0.012;

    // 16. Slight contrast lift
    base = pow(base, vec3(0.95));

    gl_FragColor = vec4(base, 1.0);
  }
`;

export default function ShaderBackground({
  darkMode = false,
  section = 0,
}) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, px: 0.5, py: 0.5, vx: 0, vy: 0 });
  const scrollRef = useRef({ y: 0, py: 0, vy: 0 });
  const propsRef = useRef({ darkMode, section });
  const reducedMotionRef = useRef(false);

  // Keep refs in sync with props (no re-init on prop change)
  useEffect(() => {
    propsRef.current = { darkMode, section };
  }, [darkMode, section]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Reduced motion check ──
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const onMotionChange = (e) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener?.('change', onMotionChange);

    // ── Renderer with dynamic DPR cap ──
    const dpr = Math.min(window.devicePixelRatio, 2);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.debug.checkShaderErrors = false;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseVel: { value: new THREE.Vector2(0, 0) },
      uScrollY: { value: 0 },
      uScrollVel: { value: 0 },
      uSection: { value: 0 },
      uDarkMode: { value: darkMode ? 1.0 : 0.0 },
      uReducedMotion: { value: reducedMotionRef.current ? 1.0 : 0.0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // ── Interaction handlers ──
    const onMouseMove = (e) => {
      const m = mouseRef.current;
      m.px = m.x;
      m.py = m.y;
      m.x = e.clientX / window.innerWidth;
      m.y = 1.0 - e.clientY / window.innerHeight;
    };

    const onScroll = () => {
      const s = scrollRef.current;
      s.py = s.y;
      s.y = window.scrollY / (document.body.scrollHeight - window.innerHeight + 0.001);
    };

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      uniforms.uResolution.value.set(w, h);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    // ── Visibility & intersection guards ──
    let raf = 0;
    let isVisible = true;
    let lastTime = performance.now();

    const onVisChange = () => {
      isVisible = !document.hidden;
      if (isVisible) lastTime = performance.now();
    };
    document.addEventListener('visibilitychange', onVisChange);

    const observer = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(canvas);

    // ── Animation loop (delta-time driven) ──
    const animate = (now) => {
      raf = requestAnimationFrame(animate);
      if (!isVisible) { lastTime = now; return; }

      const dt = Math.min((now - lastTime) * 0.001, 0.05); // cap delta
      lastTime = now;

      // Smooth mouse lerp
      const m = mouseRef.current;
      const um = uniforms.uMouse.value;
      um.x += (m.x - um.x) * 0.04;
      um.y += (m.y - um.y) * 0.04;

      // Mouse velocity (smoothed)
      const umv = uniforms.uMouseVel.value;
      const targetVx = (m.x - m.px) * 40.0;
      const targetVy = (m.y - m.py) * 40.0;
      umv.x += (targetVx - umv.x) * 0.08;
      umv.y += (targetVy - umv.y) * 0.08;
      m.px = m.x; m.py = m.y;

      // Scroll velocity (smoothed, normalized)
      const s = scrollRef.current;
      const targetSv = (s.y - s.py) * 20.0;
      const usv = uniforms.uScrollVel.value;
      uniforms.uScrollVel.value += (targetSv - usv) * 0.1;
      uniforms.uScrollY.value = s.y;
      s.py += (s.y - s.py) * 0.1; // smooth follow

      // Prop uniforms
      const p = propsRef.current;
      uniforms.uDarkMode.value += ((p.darkMode ? 1.0 : 0.0) - uniforms.uDarkMode.value) * 0.05;
      uniforms.uSection.value += ((p.section || 0) - uniforms.uSection.value) * 0.03;
      uniforms.uReducedMotion.value = reducedMotionRef.current ? 1.0 : 0.0;

      // Time (delta-driven so tab-switching doesn't jump)
      uniforms.uTime.value += dt;

      renderer.render(scene, camera);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisChange);
      mq.removeEventListener?.('change', onMotionChange);
      observer.disconnect();
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
        // If WebGL fails, graceful warm gradient fallback
        background: darkMode
          ? 'radial-gradient(ellipse at center, #0a0a0a 0%, #000 100%)'
          : 'radial-gradient(ellipse at center, #f5f0e8 0%, #ede8df 100%)',
      }}
    />
  );
}