import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Shaders                                                           */
/* ------------------------------------------------------------------ */
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

  // ---------- 3D Simplex noise (compact) ----------
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  float fbm(vec3 p) {
    float f = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 6; i++) {
      f += amp * snoise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return f;
  }

  /* Cosine palette – dark AI mood: deep blues, purples, teal */
  vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.1;
    vec2 mouse = uMouse;

    // --- Flow field ---
    float flow1 = fbm(vec3(uv * 2.5, t * 0.15));
    float flow2 = fbm(vec3(uv * 3.2 + flow1 * 0.5, t * 0.25 + mouse.x * 0.3));
    float flow  = mix(flow1, flow2, 0.5);

    // --- Mouse liquid glow (subtle) ---
    float mouseDist = length(uv - mouse);
    float mouseGlow = smoothstep(0.35, 0.0, mouseDist) * 0.2;
    vec2 mouseWarp = (uv - mouse) * mouseGlow * 0.1;
    float flowMouse = fbm(vec3(uv + mouseWarp, t * 0.4));

    // --- Faint tech grid ---
    float gridX = abs(sin((uv.x + flow * 0.3) * 14.0));
    float gridY = abs(sin((uv.y + flow * 0.3) * 14.0));
    float grid = smoothstep(0.88, 1.0, gridX) + smoothstep(0.88, 1.0, gridY);
    grid *= 0.12 * (1.0 - abs(flow) * 0.6);

    // --- Dynamic colour (dark base, cool accents) ---
    // Keep colours very dark, only subtle tints
    float hueShift = flow * 0.2 + t * 0.02;
    vec3 deepNavy  = vec3(0.02, 0.03, 0.08);   // almost black
    vec3 midBlue   = vec3(0.05, 0.08, 0.22);
    vec3 accentCyan = palette(hueShift,
                              vec3(0.1, 0.15, 0.2),
                              vec3(0.15, 0.2, 0.25),
                              vec3(0.8, 0.5, 0.5),
                              vec3(0.2, 0.3, 0.4));
    vec3 accentPurple = palette(hueShift + 0.2,
                                vec3(0.1, 0.1, 0.15),
                                vec3(0.2, 0.1, 0.25),
                                vec3(0.7, 0.3, 0.5),
                                vec3(0.4, 0.2, 0.3));

    // Base gradient from bottom (darker) to top (slightly lighter)
    vec3 color = mix(deepNavy, midBlue, uv.y * 0.5);
    // Infuse flow with very subtle colour shifts
    color = mix(color, accentCyan, flow * 0.08 + 0.02);
    color = mix(color, accentPurple, flowMouse * 0.06);
    // Mouse glow adds a gentle halo
    color = mix(color, accentCyan, mouseGlow * 0.25);
    // Grid adds faint structure
    color += grid * accentCyan * 0.6;

    // --- Organic vignette ---
    float toCenter = length(uv - 0.5) * 1.25;
    float vignette = 1.0 - toCenter;
    vignette = mix(vignette, vignette * (1.0 + flow * 0.15), 0.5);
    vignette = smoothstep(0.0, 1.0, vignette);
    color = mix(deepNavy * 0.5, color, vignette);

    // --- Subtle film grain (for that premium texture) ---
    float grain = snoise(vec3(uv * 400.0, t * 8.0)) * 0.015;
    color += grain;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
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

    let target = { x: 0.5, y: 0.5 };
    const onMouse = (e) => {
      target.x = e.clientX / window.innerWidth;
      target.y = 1.0 - e.clientY / window.innerHeight;
    };
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', onMouse);
    window.addEventListener('resize', onResize);

    let raf;
    const animate = (timestamp) => {
      uniforms.uTime.value = timestamp * 0.001;
      const m = uniforms.uMouse.value;
      m.x += (target.x - m.x) * 0.05;
      m.y += (target.y - m.y) * 0.05;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
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