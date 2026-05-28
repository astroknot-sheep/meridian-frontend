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

  // ---------- Hashing & noise ----------
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // ---------- Voronoi distance (returns dist to nearest + edge thickness) ----------
  float voronoi(vec2 uv, float scale, out float edge) {
    vec2 p = uv * scale;
    vec2 i = floor(p);
    vec2 f = fract(p);
    float mDist = 1.0;
    float mDist2 = 1.0;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = vec2(hash(i + neighbor), hash(i + neighbor + 1.0)) * 0.8 + 0.1;
        vec2 diff = neighbor + point - f;
        float d = dot(diff, diff);
        if (d < mDist) {
          mDist2 = mDist;
          mDist = d;
        } else if (d < mDist2) {
          mDist2 = d;
        }
      }
    }

    edge = abs(sqrt(mDist2) - sqrt(mDist));
    return sqrt(mDist);
  }

  // ---------- Main ----------
  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.03;

    // Mouse influence – gentle drift of the cracks
    vec2 mouseShift = (uMouse - 0.5) * 0.1;

    // Layer multiple scales of Voronoi cracks
    float edgeAccum = 0.0;
    float voronoiDist = 0.0;
    for (int i = 0; i < 4; i++) {
      float scale = 4.0 + float(i) * 3.5;
      float edge = 0.0;
      vec2 offset = vec2(
        sin(t * 1.3 + float(i)) * 0.2 + mouseShift.x,
        cos(t * 0.9 + float(i)) * 0.2 + mouseShift.y
      );
      float d = voronoi(uv + offset, scale, edge);
      voronoiDist += d * (0.6 / scale);
      // Thinner lines for smaller scales, thicker for larger
      float thickness = 0.03 + float(i) * 0.01;
      edgeAccum += smoothstep(0.0, thickness, edge) * (0.4 - float(i) * 0.08);
    }
    edgeAccum = clamp(edgeAccum, 0.0, 1.0);

    // Base colour – warm ceramic
    vec3 cream    = vec3(0.961, 0.949, 0.933);
    vec3 sand     = vec3(0.925, 0.890, 0.845);
    vec3 gold     = vec3(0.78, 0.64, 0.48);
    vec3 deep     = vec3(0.68, 0.48, 0.38);

    // Gentle radial gradient
    float radial = 1.0 - length(uv - 0.5) * 0.5;
    vec3 base = mix(cream, sand, radial);

    // The cracks become golden, with a soft glow around them
    float crackGlow = edgeAccum * 0.7;
    base = mix(base, gold, crackGlow * 0.8);

    // Deepen the base slightly near the veins to give depth
    base = mix(base, deep, crackGlow * 0.2);

    // Mouse proximity adds a warm halo on the veins
    float mouseDist = length(uv - uMouse);
    float mouseInfluence = smoothstep(0.3, 0.0, mouseDist) * 0.5;
    base = mix(base, gold, mouseInfluence * 0.6);

    // Very subtle vignette
    float vignette = 1.0 - length(uv - 0.5) * 1.0;
    base = mix(cream, base, smoothstep(0.2, 0.8, vignette));

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