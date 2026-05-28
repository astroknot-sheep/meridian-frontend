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

  /* Fractional Brownian Motion – 6 octaves, 3D input */
  float fbm(vec3 p) {
    float f = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 6; i++) {
      f += amp * snoise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return f;
  }

  /* Cosine colour palette (Inigo Quilez style) */
  vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.15;
    vec2 mouse = uMouse;

    /* ---- Layered flow field (parallax feel) ---- */
    // Primary flow – slow, deep
    float flow1 = fbm(vec3(uv * 2.5, t * 0.2));
    // Secondary flow – faster, offset by mouse
    float flow2 = fbm(vec3(uv * 3.0 + flow1 * 0.6, t * 0.35 + mouse.x));
    // Blend them
    float flow = mix(flow1, flow2, 0.5);

    /* ---- Mouse interaction – liquid glow ---- */
    float mouseDist = length(uv - mouse);
    float mouseGlow = smoothstep(0.4, 0.0, mouseDist) * 0.35;
    // Mouse‑driven distortion
    vec2 mouseWarp = (uv - mouse) * mouseGlow * 0.15;
    float flowMouse = fbm(vec3(uv + mouseWarp, t * 0.5));

    /* ---- Warped dual grid ---- */
    float gridX1 = abs(sin((uv.x + flow * 0.4 + mouseWarp.x) * 12.0));
    float gridY1 = abs(sin((uv.y + flow * 0.4 + mouseWarp.y) * 12.0));
    float grid1 = smoothstep(0.85, 1.0, gridX1) + smoothstep(0.85, 1.0, gridY1);

    // Second finer grid, rotating slowly
    vec2 uv2 = mat2(0.8, 0.6, -0.6, 0.8) * uv;
    float gridX2 = abs(sin((uv2.x + flow2 * 0.25) * 22.0));
    float gridY2 = abs(sin((uv2.y - flow2 * 0.3) * 22.0));
    float grid2 = smoothstep(0.9, 1.0, gridX2) + smoothstep(0.9, 1.0, gridY2);

    float grid = (grid1 * 0.7 + grid2 * 0.4) * (1.0 - abs(flow) * 0.5);

    /* ---- Dynamic colour palette ---- */
    // Palette parameters shift with time and flow
    float hueShift = flow * 0.25 + t * 0.02;
    vec3 bg   = vec3(0.96, 0.95, 0.93);          // warm paper base
    vec3 col1 = palette(hueShift,
                        vec3(0.5,0.5,0.5),
                        vec3(0.5,0.5,0.5),
                        vec3(1.0,1.0,1.0),
                        vec3(0.00,0.10,0.20));
    vec3 col2 = palette(hueShift + 0.15,
                        vec3(0.5,0.5,0.5),
                        vec3(0.5,0.5,0.5),
                        vec3(1.0,1.0,1.0),
                        vec3(0.30,0.20,0.20));
    // Warm golden / amber tone (fixed base)
    vec3 warmGold  = vec3(0.77, 0.66, 0.51);
    vec3 softAmber = vec3(0.72, 0.53, 0.42);

    /* ---- Compose colour ---- */
    vec3 color = bg;
    // Layer dynamic palette colours
    color = mix(color, col1, flow * 0.4 + 0.1);
    color = mix(color, col2, flowMouse * 0.3);
    // Add warmth
    color = mix(color, warmGold, abs(flow) * 0.15);
    color = mix(color, softAmber, max(flow * 0.1, 0.0));
    // Mouse light injection
    color = mix(color, warmGold * 1.2, mouseGlow * 0.5);
    color += grid * warmGold * 0.3;

    /* ---- Organic vignette with noise ---- */
    float toCenter = length(uv - 0.5) * 1.3;
    // Distort vignette with flow so edges feel alive
    float vignette = 1.0 - toCenter;
    vignette = mix(vignette, vignette * (1.0 + flow * 0.2), 0.5);
    vignette = smoothstep(0.0, 1.0, vignette);
    color = mix(bg * 0.9, color, vignette);

    /* ---- Subtle film grain ---- */
    float grain = snoise(vec3(uv * 500.0, t * 10.0)) * 0.02;
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

    // Smooth mouse lerp
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