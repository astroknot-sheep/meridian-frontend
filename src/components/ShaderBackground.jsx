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
  uniform vec2 uMouse;

  /* Soft 2D Gaussian */
  float gaussian(vec2 p, vec2 center, float sigma) {
    float d = length(p - center);
    return exp(-0.5 * (d * d) / (sigma * sigma));
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.08;
    vec2 mouse = uMouse;

    // --- Warm, creamy base (brand palette) ---
    vec3 cream  = vec3(0.961, 0.949, 0.933);
    vec3 gold   = vec3(0.77, 0.66, 0.51);
    vec3 amber  = vec3(0.72, 0.53, 0.42);

    // --- Subtle paper texture (no flow) ---
    // Create a fine, stationary grain by sampling a high‑freq sine grid
    float grain = sin(uv.x * 400.0) * sin(uv.y * 400.0) * 0.5 + 0.5;
    grain = smoothstep(0.45, 0.55, grain) * 0.015;

    // --- Faint geometric grid (elegant, barely there) ---
    vec2 gridUv = uv * 18.0;
    vec2 gridLine = abs(fract(gridUv - 0.5) - 0.5) * 2.0;
    float grid = 1.0 - max(gridLine.x, gridLine.y);
    grid = smoothstep(0.92, 1.0, grid) * 0.06;

    // --- Luminous orbs (slowly drifting) ---
    // Each orb has its own drifting position, size, and gentle pulse
    vec3 lightAccum = vec3(0.0);

    // Orb 1 – large, warm gold
    vec2 orb1Pos = vec2(
      0.5 + sin(t * 0.7) * 0.25,
      0.5 + cos(t * 0.5) * 0.2
    );
    float orb1 = gaussian(uv, orb1Pos, 0.18 + sin(t * 0.9) * 0.03);
    lightAccum += gold * orb1 * 0.45;

    // Orb 2 – smaller, amber, moves opposite
    vec2 orb2Pos = vec2(
      0.5 + cos(t * 0.6) * 0.3,
      0.5 - sin(t * 0.8) * 0.25
    );
    float orb2 = gaussian(uv, orb2Pos, 0.14 + cos(t * 1.1) * 0.02);
    lightAccum += amber * orb2 * 0.35;

    // Orb 3 – tiny, bright gold accent
    vec2 orb3Pos = vec2(
      0.5 - sin(t * 0.9 + 2.0) * 0.35,
      0.5 - cos(t * 0.7 + 2.0) * 0.28
    );
    float orb3 = gaussian(uv, orb3Pos, 0.1 + sin(t * 1.3) * 0.04);
    lightAccum += gold * 1.2 * orb3 * 0.3;

    // Orb 4 – very large, ultra‑faint glow for atmosphere
    vec2 orb4Pos = vec2(0.5, 0.45 + sin(t * 0.3) * 0.1);
    float orb4 = gaussian(uv, orb4Pos, 0.35);
    lightAccum += cream * orb4 * 0.08;

    // --- Mouse interaction (soft pull & glow) ---
    float mouseGlow = gaussian(uv, mouse, 0.15 + sin(t * 2.0) * 0.02);
    lightAccum += gold * mouseGlow * 0.25;
    // Mouse also slightly warps the grid locally (no noise)
    float mouseDist = length(uv - mouse);
    float gridBoost = smoothstep(0.3, 0.0, mouseDist) * 0.04;
    grid += gridBoost;

    // --- Compose final colour ---
    vec3 color = cream;
    color += lightAccum;          // additive blending for luminous effect
    color += grid * gold * 0.5;   // tint the grid with gold
    color += grain;               // add paper texture

    // --- Soft vignette ---
    float vignette = 1.0 - length(uv - 0.5) * 0.9;
    color = mix(cream * 0.8, color, smoothstep(0.0, 1.0, vignette));

    // Clamp values to avoid over‑brightness
    color = min(color, 1.0);
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
    };

    window.addEventListener('mousemove', onMouse);
    window.addEventListener('resize', onResize);

    let raf;
    const animate = (timestamp) => {
      uniforms.uTime.value = timestamp * 0.001;
      const m = uniforms.uMouse.value;
      m.x += (target.x - m.x) * 0.06;
      m.y += (target.y - m.y) * 0.06;
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