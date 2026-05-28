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

  // ── Brand palette (fixed – never changes) ──────────
  const vec3 bgColor   = vec3(0.961, 0.949, 0.933);
  const vec3 warmCream = vec3(0.935, 0.905, 0.865);
  const vec3 warmGold  = vec3(0.77,  0.66,  0.51);
  const vec3 softAmber = vec3(0.72,  0.53,  0.42);

  // ── Hash & Noise (ground up) ────────────────────────
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
      freq *= 2.2;
      amp *= 0.5;
    }
    return val;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.08;

    // ── Domain warping (silk/glass distortion) ─────────
    vec2 q = vec2(
      fbm(uv * 2.8 + vec2(t * 0.25, t * 0.08)),
      fbm(uv * 2.8 + vec2(t * 0.18, t * 0.22))
    );
    vec2 r = vec2(
      fbm(uv * 3.2 + q * 1.7 + vec2(t * 0.45, t * 0.15)),
      fbm(uv * 3.2 + q * 1.7 - vec2(t * 0.22, t * 0.41))
    );

    float flow = fbm(uv * 2.0 + r * 1.3);

    // ── Mouse interaction (soft glow + subtle warp) ──
    float mouseDist = length(uv - uMouse);
    float mouseGlow = exp(-mouseDist * 2.8) * 0.2;
    float mouseDistort = smoothstep(0.3, 0.0, mouseDist) * 0.03;
    flow += (uMouse.x - 0.5) * mouseDistort * 4.0;
    flow += (uMouse.y - 0.5) * mouseDistort * 4.0;

    // ── Gradation using only brand colours ─────────────
    // flow is re‑centred around 0.0 for smooth mixing
    float f = flow * 0.6; // range about -0.6..0.6

    // Base vertical grad + flow
    float grad = uv.y * 0.5 + f * 0.5;
    vec3 colour = mix(bgColor, warmCream, grad);

    // Flow pushes towards gold
    float goldFactor = smoothstep(-0.3, 0.5, f) * 0.6;
    colour = mix(colour, warmGold, goldFactor);

    // Stronger flow pushes a hint of amber
    float amberFactor = smoothstep(0.15, 0.65, f) * 0.3;
    colour = mix(colour, softAmber, amberFactor);

    // Mouse glow adds pure gold warmth
    colour = mix(colour, warmGold, mouseGlow * 0.7);

    // ── Sparkles (texture, not colour change) ───────────
    float sparkle = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 grid = floor(uv * (16.0 + float(i) * 8.0) + float(i) * 0.7);
      vec2 offset = vec2(
        hash(grid + vec2(0.33, 0.18) * float(i)) * 2.0 - 1.0,
        hash(grid + vec2(0.71, 0.56) * float(i)) * 2.0 - 1.0
      ) * 0.35;
      vec2 starUV = fract(uv * (16.0 + float(i) * 8.0)) - 0.5;
      float d = length(starUV - offset * 0.18);
      sparkle += (0.02 / (d + 0.001)) * smoothstep(0.0, 0.3, d);
    }
    sparkle *= 0.35;
    // Sparkles pull toward gold, never introduce a new colour
    colour += sparkle * warmGold * 0.6;

    // ── Vignette ─────────────────────────────────────────
    float vignette = 1.0 - length(vUv - 0.5) * 1.2;
    vignette = smoothstep(0.0, 1.0, vignette);
    colour = mix(bgColor, colour, vignette);

    gl_FragColor = vec4(colour, 1.0);
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
      m.x += (target.x - m.x) * 0.03;
      m.y += (target.y - m.y) * 0.03;
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