import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Meridian — bokeh light-field background.
 *
 * Three parallax layers of soft, defocused warm orbs drift slowly upward
 * (an elevated take on Meridian's "ambient orb" motif). Far orbs are small,
 * dim and sharp; near orbs are large, bright and creamy — giving real
 * depth-of-field. A breathing focal glow, a cursor light-pour, and an
 * animated grain/dither pass complete the "designed, not generated" finish.
 *
 * Deliberately NOT a noise-flow gradient.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;

  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  vec2 hash22(vec2 p){
    float n = sin(dot(p, vec2(41.0, 289.0)));
    return fract(vec2(262144.0, 32768.0) * n);
  }

  // One parallax layer of soft bokeh orbs over a scrolling tiled grid.
  vec3 bokeh(vec2 p, float scale, vec2 drift, float seed, vec3 tint, float baseSize, float bScale){
    vec2 g    = (p + drift) * scale;
    vec2 cell = floor(g);
    vec2 f    = fract(g) - 0.5;
    vec3 acc  = vec3(0.0);
    for (int j = -1; j <= 1; j++){
      for (int i = -1; i <= 1; i++){
        vec2 o  = vec2(float(i), float(j));
        vec2 id = cell + o;
        vec2 r  = hash22(id + seed);
        float s = hash21(id + seed * 1.7);
        vec2 c  = o + (r - 0.5) * 0.6;                  // jittered centre
        float d = length(f - c);
        float size = baseSize * (0.55 + 0.9 * s);
        float orb  = smoothstep(size, size * 0.5, d);   // soft-edged disc
        float halo = smoothstep(size * 2.2, size, d) * 0.18;
        float tw   = 0.65 + 0.35 * sin(uTime * 0.5 + s * 28.0);
        float bri  = (0.35 + 0.65 * r.x) * tw * bScale;
        acc += tint * (orb + halo) * bri;
      }
    }
    return acc;
  }

  void main(){
    vec2  uv      = vUv;
    float aspect  = uResolution.x / max(uResolution.y, 1.0);
    float breathe = 0.5 + 0.5 * sin(uTime * 0.16);      // ~10s calming cycle

    // Warm paper base — brighter toward the top so hero text stays airy.
    vec3 cream = vec3(0.965, 0.953, 0.937);
    vec3 sand  = vec3(0.929, 0.898, 0.855);
    vec3 col   = mix(sand, cream, smoothstep(0.0, 1.0, uv.y * 0.85 + 0.15));

    // Soft breathing focal warmth (the "meridian" sun).
    vec2  sun = vec2(0.5, 0.62);
    float sd  = length((uv - sun) * vec2(aspect, 1.0));
    col += vec3(0.10, 0.08, 0.05) * smoothstep(0.9, 0.0, sd) * (0.5 + 0.5 * breathe) * 0.55;

    // Aspect-corrected space so orbs stay round; mouse drives gentle parallax.
    vec2 p    = vec2(uv.x * aspect, uv.y);
    vec2 mpar = uMouse - 0.5;

    vec3 gold  = vec3(0.82, 0.70, 0.52);
    vec3 amber = vec3(0.80, 0.58, 0.45);
    vec3 lite  = vec3(0.86, 0.76, 0.58);

    vec3 glow = vec3(0.0);
    // near (big, bright, soft, most parallax)
    glow += bokeh(p, 2.4, vec2(sin(uTime * 0.05) * 0.10, -uTime * 0.012) + mpar * 0.060, 11.0, gold,  0.34, 0.95);
    // mid
    glow += bokeh(p, 4.8, vec2(sin(uTime * 0.07) * 0.08, -uTime * 0.018) + mpar * 0.035, 27.0, amber, 0.22, 0.62);
    // far (small, dim, sharp, least parallax)
    glow += bokeh(p, 8.5, vec2(sin(uTime * 0.06) * 0.06, -uTime * 0.026) + mpar * 0.020, 53.0, lite,  0.13, 0.42);

    col += glow * (0.85 + 0.15 * breathe);

    // Cursor light-pour — a soft warm pool that the orbs catch.
    float md = length((uv - uMouse) * vec2(aspect, 1.0));
    float mg = smoothstep(0.45, 0.0, md);
    col += vec3(0.060, 0.046, 0.026) * mg * (0.6 + 0.4 * breathe);

    // Warm, soft vignette (never crushes to black).
    float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(aspect, 1.0)));
    col *= mix(0.955, 1.0, vig);

    // Animated film grain + 8-bit dither — the premium, non-generated finish.
    col += (hash21(gl_FragCoord.xy + fract(uTime) * 131.0) - 0.5) * 0.024;
    col += (hash21(gl_FragCoord.xy * 0.37 + 11.0) - 0.5) / 255.0;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
      });
    } catch (e) {
      return; // No WebGL → page background shows through.
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5));
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
      vertexShader, fragmentShader, uniforms, depthWrite: false, depthTest: false,
    });
    scene.add(new THREE.Mesh(geometry, material));

    const pointer = { x: 0.5, y: 0.62 };
    const target = { x: 0.5, y: 0.62 };
    let lastMove = -100, elapsed = 0, last = performance.now(), raf = 0, running = true;

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
      const was = running;
      running = !document.hidden;
      if (running && !was) { last = performance.now(); raf = requestAnimationFrame(animate); }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    const speed = reduceMotion ? 0.14 : 1.0;
    const ease = reduceMotion ? 0.012 : 0.04;

    function animate(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt * speed;
      uniforms.uTime.value = elapsed;

      if (elapsed - lastMove > 2.5) {            // idle → slow autonomous drift
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
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: -1, pointerEvents: 'none' }}
    />
  );
}