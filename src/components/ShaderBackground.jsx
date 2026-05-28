import { useEffect, useRef } from 'react';
import * as THREE from 'three';

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

  // ── Permutation polynomial for noise ──
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  // ── Classic 2D simplex noise ──
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                   + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // ── FBM – used to create fine, organic veining ──
  float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.6;
    float freq = 1.0;
    for (int i = 0; i < 6; i++) {
      f += amp * snoise(p * freq);
      freq *= 2.2;
      amp *= 0.5;
    }
    return f;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.015;

    // ── Warp coordinates slightly for organic drift ──
    vec2 warp = vec2(
      fbm(uv * 4.5 + vec2(t * 0.2, 0.0)),
      fbm(uv * 4.5 + vec2(0.0, t * 0.2))
    );

    // ── Marble veining: sharpened ridges from noise ──
    float vein1 = abs(fbm(uv * 3.8 + warp * 0.8 + vec2(t * 0.1, -t * 0.05)));
    float vein2 = abs(fbm(uv * 5.2 - warp * 0.6 - vec2(t * 0.08, t * 0.12)));
    float vein = clamp((vein1 * 0.7 + vein2 * 0.3), 0.0, 1.0);

    // ── Edge enhancement: turn smooth noise into fine, sharp lines ──
    float veinLine = 1.0 - abs(vein - 0.48) * 14.0;
    veinLine = smoothstep(0.0, 0.7, veinLine);
    float veinGlow = exp(-abs(vein - 0.5) * 5.0) * 0.4;

    // ── Mouse: soft spotlight of warmth ──
    float mouseDist = length(uv - uMouse);
    float mouseGlow = smoothstep(0.35, 0.0, mouseDist) * 0.2;

    // ── Brand colour palette ──
    vec3 cream    = vec3(0.961, 0.949, 0.933);
    vec3 sand     = vec3(0.925, 0.890, 0.845);
    vec3 gold     = vec3(0.78, 0.64, 0.48);
    vec3 deep     = vec3(0.68, 0.48, 0.38);

    // ── Build base with subtle vertical gradient ──
    float grad = uv.y * 0.4 + 0.2;
    vec3 base = mix(cream, sand, grad);

    // ── Paint the golden veins ──
    base = mix(base, gold, veinLine * 0.7);
    base = mix(base, gold, veinGlow * 0.45);

    // ── Mouse warms the area, deepening the gold ──
    base = mix(base, gold, mouseGlow * 0.6);
    base = mix(base, deep, mouseGlow * 0.1);

    // ── Soft vignette ──
    float vignette = 1.0 - length(uv - 0.5) * 0.9;
    base = mix(cream, base, smoothstep(0.0, 0.7, vignette));

    gl_FragColor = vec4(base, 1.0);
  }
`;

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
    let raf = 0;

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

    const animate = (timestamp) => {
      uniforms.uTime.value = timestamp * 0.001;
      const m = uniforms.uMouse.value;
      m.x += (target.x - m.x) * 0.04;
      m.y += (target.y - m.y) * 0.04;
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