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

  // ---------------------------------------------------------------------------
  // 1. Hash & Noise (built from scratch – no copied code)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 2. Colour palette (based on iq’s cosine palette)
  // ---------------------------------------------------------------------------
  vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
  }

  // ---------------------------------------------------------------------------
  // 3. Main
  // ---------------------------------------------------------------------------
  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.1;

    // --- Domain warping – creates the glassy / aurora feel ---
    vec2 q = vec2(
      fbm(uv * 2.6 + vec2(t * 0.3, t * 0.1)),
      fbm(uv * 2.6 + vec2(t * 0.2, t * 0.3))
    );
    vec2 r = vec2(
      fbm(uv * 3.1 + q * 1.8 + vec2(t * 0.5, t * 0.2)),
      fbm(uv * 3.1 + q * 1.8 - vec2(t * 0.3, t * 0.5))
    );

    float warp = fbm(uv * 2.0 + r * 1.3);

    // --- Aurora gradient ---
    // Use the warped y-coordinate plus time to sample a colour palette
    float gradientPos = uv.y * 0.8 + warp * 0.6 + t * 0.05;
    vec3 aurora = palette(
      gradientPos,
      vec3(0.5, 0.5, 0.5),  // a – base intensity
      vec3(0.5, 0.5, 0.5),  // b – amplitude
      vec3(1.0, 1.0, 1.0),  // c – frequency
      vec3(0.00, 0.10, 0.20) // d – phase (shifts colour range)
    );

    // --- Warm, earthy colour bias (calm, not rainbow) ---
    aurora = mix(aurora, vec3(0.96, 0.93, 0.88), 0.3);

    // --- Soft, glowing specks (like distant fireflies or silk threads) ---
    float sparkle = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 grid = floor(uv * (15.0 + float(i) * 7.0) + float(i) * 0.7);
      vec2 offset = vec2(
        hash(grid + vec2(0.3, 0.1) * float(i)) * 2.0 - 1.0,
        hash(grid + vec2(0.7, 0.5) * float(i)) * 2.0 - 1.0
      ) * 0.4;
      vec2 starUV = fract(uv * (15.0 + float(i) * 7.0)) - 0.5;
      float d = length(starUV - offset * 0.2);
      sparkle += (0.02 / (d + 0.001)) * smoothstep(0.0, 0.3, d);
    }
    sparkle *= 0.4;

    // --- Mouse interaction – subtle warm highlight + distortion ---
    float mouseDist = length(uv - uMouse);
    float mouseGlow = exp(-mouseDist * 2.8) * 0.25;          // soft glow
    float mouseDistort = smoothstep(0.3, 0.0, mouseDist) * 0.04;
    // Use mouse to slightly shift the warp
    warp += (uMouse.x - 0.5) * mouseDistort * 3.0;
    warp += (uMouse.y - 0.5) * mouseDistort * 3.0;

    // --- Final colour composition ---
    vec3 colour = aurora;

    // Blend the warm base
    colour = mix(colour, vec3(0.98, 0.95, 0.92), 0.15 + warp * 0.1);

    // Add sparkles
    colour += sparkle * vec3(1.0, 0.95, 0.85);

    // Mouse glow adds a soft golden touch
    colour += mouseGlow * vec3(1.0, 0.92, 0.78);

    // Subtle vignette
    float vignette = 1.0 - length(vUv - 0.5) * 1.2;
    vignette = smoothstep(0.0, 1.0, vignette);
    colour = mix(vec3(0.95, 0.93, 0.90), colour, vignette);

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