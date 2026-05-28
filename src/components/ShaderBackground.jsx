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

  // ── Noise functions (clean, modern) ──────────────────
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 5; i++) {
      val += amp * noise(p * freq);
      freq *= 2.15;
      amp *= 0.47;
    }
    return val;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.08;

    // ── Domain warping (silk layers) ────────────────────
    vec2 q = vec2(
      fbm(uv * 2.8 + vec2(t * 0.25, t * -0.12)),
      fbm(uv * 2.8 + vec2(t * 0.28, t * 0.14))
    );
    vec2 r = vec2(
      fbm(uv * 3.2 + q * 1.5 + vec2(t * 0.45, t * 0.2)),
      fbm(uv * 3.2 + q * 1.5 - vec2(t * 0.3, t * 0.35))
    );
    float flow = fbm(uv * 2.0 + r * 1.1);

    // ── Mouse interactions ──────────────────────────────
    float mouseDist = length(uv - uMouse);
    float mouseGlow = smoothstep(0.5, 0.0, mouseDist) * 0.22;
    float mouseRipple = exp(-mouseDist * 6.0) * 0.1 * sin(mouseDist * 30.0 - uTime * 5.0);

    // ── Primary grid (brand signature) ──────────────────
    float gridX = abs(sin((uv.x + q.x * 0.4) * 14.0));
    float gridY = abs(sin((uv.y + q.y * 0.4) * 14.0));
    float grid = smoothstep(0.85, 1.0, gridX) + smoothstep(0.85, 1.0, gridY);
    grid = grid * 0.1 * (1.0 - abs(flow) * 0.4);

    // ── Gossamer secondary grid (ethereal) ──────────────
    float fineGridX = abs(sin((uv.x + r.x * 0.6) * 28.0 + flow * 2.0));
    float fineGridY = abs(sin((uv.y + r.y * 0.6) * 28.0 + flow * 2.0));
    float fineGrid = smoothstep(0.92, 1.0, fineGridX) + smoothstep(0.92, 1.0, fineGridY);
    fineGrid *= 0.04 * (1.0 - abs(flow) * 0.6);

    // ── Light rays (slowly sweeping) ────────────────────
    float ray1 = sin(uv.y * 20.0 - t * 2.0) * 0.5 + 0.5;
    float ray2 = sin(uv.y * 28.0 + t * 1.7 + uv.x * 2.0) * 0.5 + 0.5;
    float rays = smoothstep(0.7, 0.95, ray1 * ray2) * 0.08;

    // ── Brand colour palette (exactly as original) ──────
    vec3 bgColor   = vec3(0.961, 0.949, 0.933);
    vec3 warmCream = vec3(0.935, 0.905, 0.865);
    vec3 warmGold  = vec3(0.77, 0.66, 0.51);
    vec3 softAmber = vec3(0.72, 0.53, 0.42);

    // ── Colour blending ─────────────────────────────────
    float grad = uv.y * 0.5 + flow * 0.5;
    vec3 base = mix(bgColor, warmCream, grad);

    float mixIntensity = 0.4 + mouseGlow * 0.3;
    base = mix(base, warmGold, flow * mixIntensity * 0.5 + 0.02);
    base = mix(base, softAmber, max(flow * 0.12, 0.0));

    // Mouse spotlight
    base = mix(base, warmGold, mouseGlow * 0.5);

    // Rays add a soft shimmer
    base += rays * warmGold * 0.2;

    // Grids
    base += grid * warmGold * 0.3;
    base += fineGrid * warmGold * 0.2;

    // Mouse ripple as tiny luminance modulation
    base += mouseRipple * warmCream * 0.15;

    // ── Vignette ────────────────────────────────────────
    float vignette = 1.0 - length(vUv - 0.5) * 1.1;
    vignette = smoothstep(0.0, 1.0, vignette);
    base = mix(bgColor, base, vignette);

    gl_FragColor = vec4(base, 1.0);
  }
`;

export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
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