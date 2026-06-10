// src/components/ShaderBackground.jsx
// Meridian — living water field. Scroll-reactive only (no mouse tracking):
// scrolling stirs the surface (uStir), and the page submerges into dark
// water while a [data-water-deep] zone is in view (uDepth).
// Used by the landing page only.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`;

const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2  uRes;
uniform float uDepth;  // 0 = cream surface, 1 = deep water
uniform float uFlow;   // scroll parallax
uniform float uStir;   // scroll-velocity disturbance

vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0*fract(p*C.www)-1.0;
  vec3 h = abs(x)-0.5;
  vec3 ox = floor(x+0.5);
  vec3 a0 = x-ox;
  m *= 1.79284291400159 - 0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x = a0.x*x0.x + h.x*x0.y;
  g.yz = a0.yz*x12.xz + h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){
  float f = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){ f += a*snoise(p); p *= 2.04; a *= 0.5; }
  return f;
}

void main(){
  vec2 uv = vUv;
  uv.x *= uRes.x / uRes.y;
  float t = uTime * 0.05;
  vec2 drift = vec2(0.0, uFlow);
  float stir = 1.0 + uStir * 2.0;

  vec2 q = vec2(
    fbm(uv*1.6 + drift + vec2( t*0.9, -t*0.6)),
    fbm(uv*1.6 + drift + vec2(-t*0.7,  t*0.8) + 5.2));
  vec2 r = vec2(
    fbm(uv*2.3 + q*1.35*stir + vec2(t*1.5, t*0.4)),
    fbm(uv*2.3 + q*1.35*stir - vec2(t*0.5, t*1.2) + 8.7));
  float w = fbm(uv*1.4 + r + drift*0.6);

  float c1 = 1.0 - abs(snoise(uv*3.0 + r*1.8 + vec2(0.0, t*2.1)));
  float c2 = 1.0 - abs(snoise(uv*5.4 + q*2.2 - vec2(t*1.5, 0.0)));
  float caustic = pow(max(c1*0.62 + c2*0.46, 0.0), 3.0);

  vec3 gold = vec3(0.769, 0.659, 0.510);

  // Surface: quiet warm paper-water.
  vec3 surf = mix(vec3(0.961,0.949,0.933), vec3(0.910,0.875,0.816), smoothstep(-0.6, 0.7, w));
  surf = mix(surf, gold, caustic*0.085 + smoothstep(0.15, 0.85, w)*0.05 + uStir*0.03);

  // Deep: ink with gold caustics.
  vec3 deep = mix(vec3(0.051,0.047,0.041), vec3(0.114,0.092,0.071), smoothstep(-0.4, 0.8, w));
  deep += gold * caustic * (0.16 + uStir*0.12);
  deep += gold * smoothstep(0.25, 0.9, w) * 0.05;

  float d = smoothstep(0.0, 1.0, uDepth);
  vec3 col = mix(surf, deep, d);

  float vig = smoothstep(0.95, 0.3, length(vUv - vec2(0.5, 0.42)));
  col *= mix(1.0 - (0.06 + 0.12*d), 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}`;

export default function ShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas, antialias: false, alpha: false, powerPreference: 'low-power',
      });
    } catch {
      // CSS fallback paints the page (see landing.css html.no-webgl rules).
      document.documentElement.classList.add('no-webgl');
      return undefined;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      uTime: { value: reduced ? 7.0 : 0 }, // frozen, pleasant frame for reduced motion
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uDepth: { value: 0 },
      uFlow: { value: 0 },
      uStir: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms });
    scene.add(new THREE.Mesh(geometry, material));

    let raf = 0;
    let queued = false;
    let lastY = window.scrollY;
    let stir = 0;
    let depth = 0;
    let zoneEl = document.querySelector('[data-water-deep]');

    const frame = (now) => {
      if (!reduced) uniforms.uTime.value = now * 0.001;

      const y = window.scrollY;
      stir = Math.min(1, stir * 0.93 + Math.min(Math.abs(y - lastY) * 0.004, 0.2));
      lastY = y;
      uniforms.uFlow.value = y * 0.00045;
      uniforms.uStir.value = stir;

      let target = 0;
      if (!zoneEl) zoneEl = document.querySelector('[data-water-deep]');
      if (zoneEl) {
        const r = zoneEl.getBoundingClientRect();
        target = Math.max(0, Math.min(1, (window.innerHeight * 0.85 - r.top) / (window.innerHeight * 0.55)));
      }
      depth = reduced ? target : depth + (target - depth) * 0.06;
      uniforms.uDepth.value = depth;

      renderer.render(scene, camera);
      if (!reduced) raf = requestAnimationFrame(frame);
      else queued = false;
    };

    // Reduced motion: render only on scroll/resize, with time frozen.
    const kick = () => {
      if (!queued) { queued = true; raf = requestAnimationFrame(frame); }
    };

    if (reduced) {
      kick();
      window.addEventListener('scroll', kick, { passive: true });
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
      zoneEl = document.querySelector('[data-water-deep]');
      if (reduced) kick();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', kick);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="water-canvas" aria-hidden="true" />;
}