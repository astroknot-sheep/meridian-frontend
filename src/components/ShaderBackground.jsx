import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Vertex Shader                                                      */
/* ------------------------------------------------------------------ */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/*  Fragment Shader (Ray-marched 3D luxury still life)                 */
/* ------------------------------------------------------------------ */
const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uResolution;

  const int MAX_STEPS = 80;
  const float MAX_DIST = 20.0;
  const float SURF_DIST = 0.001;

  // SDFs
  float sdSphere(vec3 p, float r) { return length(p) - r; }
  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }
  float sdPlane(vec3 p, float y) { return p.y - y; }

  float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5*(d2-d1)/k, 0.0, 1.0);
    return mix(d2, d1, h) - k*h*(1.0-h);
  }

  float map(vec3 p, float time) {
    float t = time * 0.2;

    // Central large sphere
    vec3 p0 = p - vec3(0.0, 1.0 + sin(t*1.1)*0.2, 0.0);
    float d0 = sdSphere(p0, 0.9);

    // Torus ring
    vec3 p1 = p - vec3(0.0, 1.0, 0.0);
    float d1 = sdTorus(p1*0.9, vec2(1.1+sin(t*0.7)*0.05, 0.18));

    // Accent spheres
    vec3 p2 = p - vec3(1.3+cos(t*0.8)*0.15, 0.6+sin(t*0.9)*0.1, 0.6);
    float d2 = sdSphere(p2, 0.25);

    vec3 p3 = p - vec3(-1.1+sin(t*0.7)*0.2, 0.8+cos(t*1.0)*0.15, -0.5);
    float d3 = sdSphere(p3, 0.3);

    vec3 p4 = p - vec3(0.6+cos(t*0.6)*0.3, 1.7+sin(t*0.8)*0.25, -0.8);
    float d4 = sdSphere(p4, 0.35);

    float ground = sdPlane(p, -0.2);

    float scene = opSmoothUnion(d0, d1, 0.5);
    scene = opSmoothUnion(scene, d2, 0.3);
    scene = opSmoothUnion(scene, d3, 0.3);
    scene = opSmoothUnion(scene, d4, 0.3);
    scene = min(scene, ground);
    return scene;
  }

  vec3 calcNormal(vec3 p, float time) {
    float eps = 0.001;
    return normalize(vec3(
      map(p+vec3(eps,0,0),time)-map(p-vec3(eps,0,0),time),
      map(p+vec3(0,eps,0),time)-map(p-vec3(0,eps,0),time),
      map(p+vec3(0,0,eps),time)-map(p-vec3(0,0,eps),time)
    ));
  }

  float shadow(vec3 ro, vec3 rd, float mint, float maxt, float k, float time) {
    float res = 1.0;
    float t = mint;
    for (int i=0; i<30; i++) {
      float h = map(ro+rd*t, time);
      if (h<0.001) return 0.0;
      res = min(res, k*h/t);
      t += h;
      if (t>=maxt) break;
    }
    return res;
  }

  float ao(vec3 p, vec3 n, float time) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i=0; i<5; i++) {
      float h = 0.01 + 0.12*float(i)/4.0;
      float d = map(p+h*n, time);
      occ += (h-d)*sca;
      sca *= 0.95;
    }
    return clamp(1.0-3.0*occ, 0.0, 1.0);
  }

  vec3 getColor(vec3 p, float time) {
    // Evaluate each object’s distance to determine which one we're on
    float d0 = sdSphere(p-vec3(0.0,1.0+sin(time*0.22)*0.2,0.0), 0.9);
    float d1 = sdTorus((p-vec3(0.0,1.0,0.0))*0.9, vec2(1.1+sin(time*0.14)*0.05, 0.18));
    float d2 = sdSphere(p-vec3(1.3+cos(time*0.16)*0.15, 0.6+sin(time*0.18)*0.1, 0.6), 0.25);
    float d3 = sdSphere(p-vec3(-1.1+sin(time*0.14)*0.2, 0.8+cos(time*0.2)*0.15, -0.5), 0.3);
    float d4 = sdSphere(p-vec3(0.6+cos(time*0.12)*0.3, 1.7+sin(time*0.16)*0.25, -0.8), 0.35);
    float ground = sdPlane(p, -0.2);

    vec3 gold   = vec3(0.77, 0.66, 0.51);
    vec3 amber  = vec3(0.72, 0.53, 0.42);
    vec3 bronze = vec3(0.55, 0.42, 0.28);
    vec3 cream  = vec3(0.961, 0.949, 0.933);
    vec3 peach  = vec3(0.92, 0.78, 0.65);

    float minD = 1e5;
    vec3 col = cream; // default

    if (d0 < minD) { minD = d0; col = gold; }
    if (d1 < minD) { minD = d1; col = amber; }
    if (d2 < minD) { minD = d2; col = peach; }
    if (d3 < minD) { minD = d3; col = bronze; }
    if (d4 < minD) { minD = d4; col = gold; }
    if (ground < minD) { col = cream; }

    return col;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x/uResolution.y, 1.0);

    // Camera setup (orbiting)
    float time = uTime;
    float camDist = 4.2;
    float camYaw   = time * 0.12;
    float camPitch = 0.4 + sin(time * 0.2) * 0.15; // gentle tilt

    vec3 ro = vec3(cos(camPitch)*sin(camYaw), sin(camPitch), cos(camPitch)*cos(camYaw)) * camDist;
    vec3 lookAt = vec3(0.0, 0.9, 0.0);
    vec3 forward = normalize(lookAt - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 rd = normalize(forward + right*uv.x + up*uv.y);

    // Ray marching
    float d = 0.0;
    float t = 0.0;
    for (int i=0; i<MAX_STEPS; i++) {
      vec3 p = ro + rd * t;
      d = map(p, time);
      if (d < SURF_DIST || t > MAX_DIST) break;
      t += d;
    }

    vec3 col = vec3(0.961, 0.949, 0.933); // cream background
    if (d < SURF_DIST) {
      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p, time);
      vec3 matCol = getColor(p, time);

      // Lighting
      vec3 lightPos = vec3(2.0, 3.0, 2.0);
      vec3 lightDir = normalize(lightPos - p);
      vec3 ambient = vec3(0.2, 0.18, 0.15);
      float diff = max(dot(n, lightDir), 0.0);
      float sh = shadow(p, lightDir, 0.02, length(lightPos-p), 8.0, time);
      float occ = ao(p, n, time);

      // Specular (Fresnel-like)
      vec3 viewDir = normalize(ro - p);
      vec3 halfVec = normalize(lightDir + viewDir);
      float spec = pow(max(dot(n, halfVec), 0.0), 40.0);
      float fresnel = pow(1.0 - abs(dot(n, viewDir)), 3.0);

      vec3 lightCol = vec3(1.0, 0.95, 0.85);
      col = matCol * (ambient + diff * lightCol * sh * occ);
      col += spec * lightCol * 0.3;
      col += fresnel * vec3(0.3, 0.25, 0.2); // warm rim light
    }

    // Subtle vignette
    float vig = 1.0 - length(vUv - 0.5) * 0.7;
    col *= smoothstep(0.0, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
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
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
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
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', onMouse);
    window.addEventListener('resize', onResize);

    let raf;
    const animate = (timestamp) => {
      uniforms.uTime.value = timestamp * 0.001;
      const m = uniforms.uMouse.value;
      m.x += (target.x - m.x) * 0.05;
      m.y += (target.y - m.y) * 0.05;
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