import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/*
 * Meridian field — a slowly drifting, engraved contour map.
 * Thin gold iso-lines ("meridians") trace a warm noise field that
 * calms and settles as the visitor scrolls deeper into the page.
 * No mouse tracking. Time + scroll only.
 */

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
  uniform float uScroll;
  uniform vec2 uResolution;

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
    for (int i = 0; i < 4; i++) {
      f += amp * snoise(p * freq);
      freq *= 2.05;
      amp *= 0.5;
    }
    return f;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.045;
    float calm = 1.0 - uScroll * 0.5; // the field settles as you go deeper

    vec2 q = vec2(
      fbm(p * 1.5 + vec2(t * 0.9, -t * 0.6)),
      fbm(p * 1.5 + vec2(-t * 0.4, t * 0.7) + 3.71)
    );
    float field = fbm(p * 2.1 + q * (0.85 * calm + 0.25) + vec2(0.0, uScroll * 0.9));

    // engraved iso-lines of the field
    float bands = field * 13.0;
    float d = abs(fract(bands) - 0.5);
    float contour = 1.0 - smoothstep(0.02, 0.075, d);
    contour *= smoothstep(0.02, 0.30, abs(field)); // fade where the field is flat

    vec3 paper = vec3(0.961, 0.949, 0.933); // #F5F2EE
    vec3 cream = vec3(0.933, 0.906, 0.867);
    vec3 gold  = vec3(0.769, 0.659, 0.510); // #C4A882
    vec3 umber = vec3(0.478, 0.416, 0.345); // #7A6A58

    float wash = smoothstep(-0.7, 0.9, field);
    vec3 col = mix(paper, cream, wash);
    col = mix(col, gold, max(field, 0.0) * 0.07);

    vec3 ink = mix(gold, umber, 0.30);
    col = mix(col, ink, contour * 0.17);

    // a faint horizon of light that sinks with scroll
    float hy = 0.66 - uScroll * 0.30 + 0.04 * sin(t * 1.3);
    float horizon = exp(-pow((uv.y - hy) * 4.5, 2.0));
    col = mix(col, gold, horizon * 0.06);

    // settle edges back to paper
    float vig = smoothstep(1.35, 0.30, distance(uv, vec2(0.5, 0.55)));
    col = mix(paper, col, vig);

    // fine grain so flats never band
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (g - 0.5) * 0.014;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, powerPreference: 'low-power',
    });
    const dprCap = window.innerWidth < 760 ? 1.25 : 1.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms, depthWrite: false,
    });
    scene.add(new THREE.Mesh(geometry, material));

    let raf = 0;
    let scrollTarget = 0;
    let onVis = null;

    const onScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      scrollTarget = Math.min(window.scrollY / max, 1);
    };
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      onScroll();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    onScroll();

    const renderFrame = (ts) => {
      uniforms.uTime.value = ts * 0.001;
      uniforms.uScroll.value += (scrollTarget - uniforms.uScroll.value) * 0.05;
      renderer.render(scene, camera);
    };

    if (reduced) {
      renderFrame(0); // one calm, static frame
    } else {
      const loop = (ts) => { renderFrame(ts); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      onVis = () => {
        cancelAnimationFrame(raf);
        if (!document.hidden) raf = requestAnimationFrame(loop);
      };
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (onVis) document.removeEventListener('visibilitychange', onVis);
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
        width: '100%',
        height: '100%',
        zIndex: -2,
        pointerEvents: 'none',
      }}
    />
  );
}