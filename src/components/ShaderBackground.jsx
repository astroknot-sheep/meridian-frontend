// PremiumShaderBackground.jsx
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
  uniform vec2 uMouseVelocity; // new: for trail direction
  uniform float uMouseTrail;   // intensity of trail (decay)

  // --- Noise functions (same as before) ---
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float f = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 5; i++) {
      f += amp * snoise(p * freq);
      freq *= 2.1;
      amp *= 0.48;
    }
    return f;
  }

  // --- Iridescent color function ---
  vec3 iridescentColor(float t) {
    // Map t (0..1) through a sophisticated HSL curve
    float hue = fract(t * 0.8 + 0.6); // shift range to warm golds->pinks->blues
    float sat = 0.35 + 0.15 * sin(t * 3.14);
    float lum = 0.88 + 0.08 * sin(t * 6.28);
    // Convert HSL to RGB (simplified, assume hue 0..1)
    vec3 rgb = clamp(abs(mod(hue * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return mix(vec3(0.96, 0.95, 0.93), rgb, sat) * lum;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 uvAspect = vec2(uv.x * aspect, uv.y); // keep correct noise scaling

    // --- Mouse influence: repel flow (like a force field) ---
    vec2 toMouse = uMouse - uv;
    float dist = length(toMouse);
    float repelStrength = smoothstep(0.35, 0.0, dist) * 0.5;
    vec2 repelForce = normalize(toMouse + 0.001) * repelStrength;

    // --- Mouse trail (simulated decay) ---
    float trail = uMouseTrail * smoothstep(0.3, 0.0, dist) * exp(-dist * 4.0);
    vec2 trailFlow = uMouseVelocity * trail * 0.6;

    // --- Layer 1: Background slow flow (parallax depth) ---
    float t = uTime * 0.08;
    vec2 flow1 = vec2(
      fbm(uvAspect * 1.6 + vec2(t * 0.15, t * 0.1) + repelForce * 0.8),
      fbm(uvAspect * 1.6 + vec2(t * 0.12, -t * 0.13) - repelForce * 0.8)
    );

    // --- Layer 2: Midground “neural threads” ---
    vec2 q = vec2(
      fbm(uvAspect * 2.8 + flow1 * 1.5 + trailFlow),
      fbm(uvAspect * 2.8 - flow1 * 1.5 - trailFlow)
    );
    float threadField = fbm(uvAspect * 3.2 + q * 1.2);
    // Generate thin glowing filaments where threadField is near zero (ridges)
    float filaments = 1.0 - abs(threadField) * 2.8;
    filaments = smoothstep(0.4, 0.8, filaments) * 0.4;

    // --- Combine flows for color index ---
    float mainFlow = fbm(uvAspect * 1.4 + flow1 * 0.9 + q * 0.5);
    float flowMagnitude = length(flow1) * 0.6 + abs(mainFlow) * 0.4;

    // --- Iridescent coloring ---
    vec3 baseColor = iridescentColor(flowMagnitude + uTime * 0.02);
    // Warm highlight on edges of flow
    vec3 highlightColor = iridescentColor(flowMagnitude + 0.15);
    baseColor = mix(baseColor, highlightColor, filaments * 0.7);

    // --- Add mouse interaction: soft glow in trail wake ---
    vec3 mouseGlow = mix(vec3(0.95, 0.9, 0.75), vec3(0.7, 0.55, 0.85), trail);
    baseColor = mix(baseColor, mouseGlow, trail * 0.4);

    // --- Filaments get an ethereal white-gold glow ---
    baseColor += filaments * vec3(0.15, 0.12, 0.05);

    // --- Organic grain (dithering) ---
    float grain = snoise(uvAspect * 800.0 + uTime * 4.0) * 0.03;
    baseColor += grain;

    // --- Vignette: soft, flow-aware darkening ---
    float edgeDist = length(uv - 0.5) * 1.6;
    float vignette = 1.0 - smoothstep(0.5, 1.4, edgeDist + mainFlow * 0.2);
    baseColor *= vignette;

    // --- Final subtle S-curve contrast to make it pop ---
    baseColor = pow(baseColor, vec3(1.1));
    
    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseVelocity: { value: new THREE.Vector2(0, 0) },
      uMouseTrail: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Smooth mouse tracking with inertia
    let target = new THREE.Vector2(0.5, 0.5);
    let current = new THREE.Vector2(0.5, 0.5);
    let prevMouse = new THREE.Vector2(0.5, 0.5);
    let velocity = new THREE.Vector2(0, 0);
    let trailIntensity = 0;
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

      // Smooth interpolate mouse
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      uniforms.uMouse.value.copy(current);

      // Calculate velocity and trail decay
      velocity.x = current.x - prevMouse.x;
      velocity.y = current.y - prevMouse.y;
      uniforms.uMouseVelocity.value.copy(velocity);
      trailIntensity += length(velocity) * 0.8;
      trailIntensity *= 0.92; // decay
      uniforms.uMouseTrail.value = clamp(trailIntensity, 0, 1);
      prevMouse.copy(current);

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
        // Subtle background fallback for when canvas is loading
        background: 'linear-gradient(145deg, #f5f2eb 0%, #f0e9db 100%)',
      }}
    />
  );
}