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

  // Classic simplex noise helpers
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
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

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.12;

    // === DOMAIN WARPING + MOUSE PERTURBATION ===
    vec2 q = vec2(
      fbm(uv * 2.4 + vec2(t * 0.2, t * -0.12)),
      fbm(uv * 2.4 + vec2(t * 0.25, t * 0.15))
    );

    // Mouse gently distorts the actual flow field (premium tactile feel)
    vec2 mouseDir = uv - uMouse;
    float mouseDist = length(mouseDir);
    float mouseFlowInfluence = smoothstep(0.55, 0.0, mouseDist) * 0.18;
    q += normalize(mouseDir + 0.0001) * mouseFlowInfluence;

    vec2 r = vec2(
      fbm(uv * 2.8 + q * 1.2 + vec2(t * 0.5, t * 0.2)),
      fbm(uv * 2.8 + q * 1.2 - vec2(t * 0.28, t * 0.38))
    );

    float flow = fbm(uv * 1.8 + r);

    // === FAKE NORMAL + LIGHTING (material depth) ===
    float eps = 0.0018;
    float dfx = fbm(uv * 1.8 + r + vec2(eps, 0.0)) - fbm(uv * 1.8 + r - vec2(eps, 0.0));
    float dfy = fbm(uv * 1.8 + r + vec2(0.0, eps)) - fbm(uv * 1.8 + r - vec2(0.0, eps));
    vec3 normal = normalize(vec3(dfx, dfy, 1.0));

    vec3 lightDir = normalize(vec3(0.35, 0.65, 1.0));
    float NdotL = max(dot(normal, lightDir), 0.0);
    float rim = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);

    // === MOUSE GLOW ===
    float mouseGlow = smoothstep(0.48, 0.0, mouseDist) * 0.22;

    // === WARPED + INTEGRATED GRID ===
    float gridX = abs(sin((uv.x + q.x * 0.38) * 13.5));
    float gridY = abs(sin((uv.y + q.y * 0.38) * 13.5));
    float grid = smoothstep(0.86, 1.0, gridX) + smoothstep(0.86, 1.0, gridY);
    grid = grid * 0.095 * (1.0 - abs(flow) * 0.45);

    // === SUBTLE HIGH-FREQUENCY DETAIL (emergent micro-texture) ===
    float fineDetail = snoise(uv * 48.0 + t * 0.6) * 0.5 + 0.5;
    fineDetail = pow(fineDetail, 1.8) * 0.035;

    // === COLOR PALETTE + BREATHING ===
    vec3 bgColor     = vec3(0.961, 0.949, 0.933);
    vec3 warmCream   = vec3(0.935, 0.905, 0.865);
    vec3 warmGold    = vec3(0.77,  0.66,  0.51);
    vec3 softAmber   = vec3(0.72,  0.53,  0.42);

    float breath = sin(uTime * 0.035) * 0.5 + 0.5;
    float grad = uv.y * 0.58 + flow * 0.42 + breath * 0.04;

    vec3 base = mix(bgColor, warmCream, grad);

    float mixIntensity = 0.44 + mouseGlow * 0.6;
    base = mix(base, warmGold, flow * mixIntensity * 0.52 + 0.035);
    base = mix(base, softAmber, max(flow * 0.18, 0.0));
    base = mix(base, warmGold, mouseGlow * 0.65);

    // Apply lighting
    base = mix(base, base * 1.18, NdotL * 0.28);
    base += rim * warmGold * 0.12;

    // Grid + fine detail
    base += grid * warmGold * 0.38;
    base += fineDetail * (warmGold * 0.7 + vec3(0.1));

    // Vignette
    float vignette = 1.0 - length(vUv - 0.5) * 1.08;
    vignette = smoothstep(0.0, 1.05, vignette);
    base = mix(bgColor * 0.96, base, vignette);

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
      powerPreference: 'high-performance',
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

    let targetMouse = { x: 0.5, y: 0.5 };
    let currentMouse = { x: 0.5, y: 0.5 };

    const onMouseMove = (e) => {
      targetMouse.x = e.clientX / window.innerWidth;
      targetMouse.y = 1.0 - e.clientY / window.innerHeight;
    };

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    let raf = 0;

    const animate = (timestamp) => {
      uniforms.uTime.value = timestamp * 0.001;

      // Premium smooth mouse follow
      const lerp = 0.085;
      currentMouse.x += (targetMouse.x - currentMouse.x) * lerp;
      currentMouse.y += (targetMouse.y - currentMouse.y) * lerp;
      uniforms.uMouse.value.set(currentMouse.x, currentMouse.y);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
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