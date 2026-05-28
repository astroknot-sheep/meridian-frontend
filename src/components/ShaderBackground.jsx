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

  // Soft lens – creates blurry elliptical light blobs
  float lens(vec2 uv, vec2 center, vec2 radius, float blur) {
    vec2 d = (uv - center) / radius;
    float r = length(d);
    return smoothstep(1.0, 1.0 - blur, r);
  }

  // Sharp star highlight (optional)
  float star(vec2 uv, vec2 center, float size) {
    vec2 d = uv - center;
    float a = atan(d.y, d.x);
    float r = length(d);
    float rays = abs(cos(a * 6.0)); // 6-pointed star
    return smoothstep(size, 0.0, r) * rays;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.1;

    // --- Brand base colours ---
    vec3 cream  = vec3(0.961, 0.949, 0.933);
    vec3 gold   = vec3(0.77, 0.66, 0.51);
    vec3 amber  = vec3(0.72, 0.53, 0.42);
    vec3 peach  = vec3(0.92, 0.78, 0.65);
    vec3 bronze = vec3(0.55, 0.42, 0.28);

    // --- Create a dynamic "caustic lattice" using lens blobs ---
    vec3 light = vec3(0.0);

    // Blade 1 – large slow gold ellipse
    vec2 b1_center = vec2(
      0.5 + sin(t * 0.3) * 0.25,
      0.5 + cos(t * 0.4) * 0.2
    );
    vec2 b1_radius = vec2(0.5, 0.25) * (1.0 + 0.2 * sin(t * 0.7));
    float b1 = lens(uv, b1_center, b1_radius, 0.6);
    light += gold * b1 * 0.55;

    // Blade 2 – medium amber, moving opposite, different angle
    vec2 b2_center = vec2(
      0.5 + cos(t * 0.5) * 0.3,
      0.5 - sin(t * 0.6) * 0.25
    );
    vec2 b2_radius = vec2(0.35, 0.55) * (1.0 + 0.15 * cos(t * 0.9));
    float b2 = lens(uv, b2_center, b2_radius, 0.5);
    light += amber * b2 * 0.45;

    // Blade 3 – sharper, brighter, for highlights (bronze/peach)
    vec2 b3_center = vec2(
      0.5 - sin(t * 0.8 + 1.5) * 0.35,
      0.5 - cos(t * 0.7 + 1.5) * 0.3
    );
    vec2 b3_radius = vec2(0.2, 0.4) * (1.0 + 0.25 * sin(t * 1.2));
    float b3 = lens(uv, b3_center, b3_radius, 0.7);
    light += peach * b3 * 0.6;
    light += bronze * b3 * 0.2; // extra depth

    // Blade 4 – very wide, ultra‑soft background glow (cream)
    vec2 b4_center = vec2(0.5, 0.48 + sin(t * 0.2) * 0.1);
    vec2 b4_radius = vec2(0.9, 0.6);
    float b4 = lens(uv, b4_center, b4_radius, 0.3);
    light += cream * b4 * 0.12;

    // --- Geometric grid (faint, elegant) ---
    vec2 gridUv = uv * 20.0;
    vec2 gridLine = abs(fract(gridUv - 0.5) - 0.5) * 2.0;
    float grid = 1.0 - max(gridLine.x, gridLine.y);
    grid = smoothstep(0.92, 1.0, grid) * 0.05;

    // Fine diagonal grid lines for extra texture
    float grid2 = abs(sin(uv.x * 40.0 + uv.y * 40.0));
    grid2 = smoothstep(0.95, 1.0, grid2) * 0.03;
    grid += grid2;

    // --- Mouse interaction (localized spotlight & warp) ---
    vec2 mouse = uMouse;
    float mouseGlow = lens(uv, mouse, vec2(0.18), 0.8);
    light += gold * mouseGlow * 0.25;
    // The grid brightens near the mouse
    float mouseDist = length(uv - mouse);
    grid += smoothstep(0.35, 0.0, mouseDist) * 0.06;

    // --- Fine grain (preserves the paper texture feel) ---
    float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    grain = (grain - 0.5) * 0.02;

    // --- Compose final colour ---
    vec3 color = cream;
    color += light;                       // additive blending for caustics
    color += grid * gold * 0.5;          // tint the grid
    color += grain;

    // Soft vignette
    float vignette = 1.0 - length(uv - 0.5) * 0.85;
    color = mix(cream * 0.85, color, smoothstep(0.0, 1.0, vignette));

    // Clamp to avoid blow‑out
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