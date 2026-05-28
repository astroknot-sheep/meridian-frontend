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

  // Simplex 2D noise (smooth, organic)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

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
    vec3 m = max(0.5 - vec3(dot(x0, x0),
                           dot(x12.xy, x12.xy),
                           dot(x12.zw, x12.zw)), 0.0);
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

  // Layered noise with domain warping
  float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 6; i++) {
      f += amp * snoise(p * freq);
      freq *= 2.1;
      amp *= 0.45;
    }
    return f;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.08;

    // Warped coordinates for fluid movement
    vec2 q = vec2(
      fbm(uv * 3.2 + vec2(t * 0.3, t * -0.15)),
      fbm(uv * 3.2 + vec2(t * 0.35, t * 0.1))
    );
    vec2 r = vec2(
      fbm(uv * 3.5 + q * 1.5 + vec2(t * 0.6, t * 0.2)),
      fbm(uv * 3.5 + q * 1.5 - vec2(t * 0.3, t * 0.4))
    );

    float flow = fbm(uv * 2.5 + r * 1.2);

    // Mouse interaction – soft spotlight
    float mouseDist = length(uv - uMouse);
    float mouseGlow = smoothstep(0.4, 0.0, mouseDist) * 0.18;

    // Subtle grid overlay (silken texture)
    float gridX = abs(sin((uv.x + q.x * 0.4) * 18.0));
    float gridY = abs(sin((uv.y + q.y * 0.4) * 18.0));
    float grid = smoothstep(0.82, 1.0, gridX) + smoothstep(0.82, 1.0, gridY);
    grid *= 0.06 * (1.0 - abs(flow) * 0.6);

    // Colour palette – warm, earthy, sophisticated
    vec3 cream    = vec3(0.961, 0.949, 0.933);
    vec3 sand     = vec3(0.925, 0.890, 0.845);
    vec3 gold     = vec3(0.78, 0.64, 0.48);
    vec3 deep     = vec3(0.68, 0.48, 0.38);

    // Vertical + noise gradient
    float grad = uv.y * 0.5 + flow * 0.5;
    vec3 base = mix(cream, sand, grad);

    // Flow intensity modulates warmth
    float intensity = 0.45 + mouseGlow * 0.5;
    base = mix(base, gold, flow * intensity * 0.6 + 0.02);
    base = mix(base, deep, max(flow * 0.1, 0.0));

    // Mouse adds a touch of golden warmth
    base = mix(base, gold, mouseGlow * 0.7);

    // Subtle grid highlights
    base += grid * gold * 0.4;

    // Vignette – gentle fade toward edges
    float vignette = 1.0 - length(vUv - 0.5) * 1.1;
    vignette = smoothstep(0.0, 1.0, vignette);
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