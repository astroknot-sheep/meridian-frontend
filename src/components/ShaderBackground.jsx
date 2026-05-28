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

  // ---------- Soft noise for gentle undulation ----------
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Multi-octave smooth noise
  float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 5; i++) {
      f += amp * noise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return f;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.04;

    // Very slow, large-scale undulation
    vec2 uvShifted = uv + vec2(
      fbm(uv * 2.0 + t * 0.2),
      fbm(uv * 2.0 - t * 0.3)
    ) * 0.2;

    // Light/dark waves – incredibly soft
    float wave1 = fbm(uvShifted * 3.5 + t * 0.1) * 0.5 + 0.5;
    float wave2 = fbm(uvShifted * 1.8 - t * 0.15) * 0.4 + 0.5;
    float softPattern = (wave1 * 0.6 + wave2 * 0.4);

    // Warm spotlight that follows the mouse gently
    float mouseDist = length(uv - uMouse);
    float mouseGlow = 1.0 - smoothstep(0.0, 0.55, mouseDist);
    mouseGlow = pow(mouseGlow, 2.5) * 0.22; // soft, wide halo

    // Brand colours
    vec3 cream    = vec3(0.961, 0.949, 0.933);
    vec3 sand     = vec3(0.925, 0.890, 0.845);
    vec3 gold     = vec3(0.78, 0.64, 0.48);
    vec3 deep     = vec3(0.68, 0.48, 0.38);

    // Base gradient: cream at top, sand at bottom
    vec3 base = mix(cream, sand, uv.y * 0.5 + 0.1);

    // Soft pattern adds subtle warmth variation
    base = mix(base, sand, softPattern * 0.3);
    base = mix(base, gold, softPattern * 0.12);

    // Mouse glow adds a golden, nurturing spotlight
    base = mix(base, gold, mouseGlow);
    base = mix(base, cream, mouseGlow * 0.3); // keeps it from getting too dark

    // Very subtle vignette
    float vignette = 1.0 - length(uv - 0.5) * 0.9;
    vignette = smoothstep(0.1, 0.8, vignette);
    base = mix(cream, base, vignette);

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