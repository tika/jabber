import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  EffectComposer,
  OutputPass,
  RenderPass,
} from "three/examples/jsm/Addons.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// Reuse existing shaders
const vertexShader = `
  vec3 mod289(vec3 x)
  {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 mod289(vec4 x)
  {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  vec4 permute(vec4 x)
  {
    return mod289(((x*34.0)+10.0)*x);
  }

  vec4 taylorInvSqrt(vec4 r)
  {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  vec3 fade(vec3 t) {
    return t*t*t*(t*(t*6.0-15.0)+10.0);
  }

  float pnoise(vec3 P, vec3 rep)
  {
    vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
    vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
    Pi0 = mod289(Pi0);
    Pi1 = mod289(Pi1);
    vec3 Pf0 = fract(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 * (1.0 / 7.0);
    vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 * (1.0 / 7.0);
    vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }

  uniform float u_time;
  uniform float u_frequency;

  void main() {
    float noise = 5.0 * pnoise(position + u_time, vec3(10.));
    float displacement = (u_frequency / 30.0) * (noise / 10.0);
    vec3 newPosition = position + normal * displacement  ;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  uniform float u_red;
  uniform float u_green;
  uniform float u_blue;

  void main() {
    gl_FragColor = vec4(u_red, u_green, u_blue, 1.0);
  }
`;

export default function MicAudioVisualizer({
  mediaStream,
  color,
}: {
  mediaStream: MediaStream | undefined;
  color: string; // just a random number to identify the speaker
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mediaStream) return;

    const audioContext = new window.AudioContext();
    const source = audioContext.createMediaStreamSource(mediaStream);
    const newAnalyser = audioContext.createAnalyser();
    newAnalyser.fftSize = 256;
    source.connect(newAnalyser);
    setAnalyser(newAnalyser);

    return () => {
      audioContext.close();
      setAnalyser(null);
    };
  }, [mediaStream]);

  // Render effect
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = null;
    const size = window.innerWidth / 10;
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      premultipliedAlpha: false, // Add this line
    });

    // Replace the container's content with the renderer's DOM element
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    renderer.setSize(size, size);

    // renderer.setClearColor(0x000000, 0); // Set alpha to 0
    renderer.setClearColor(color, 1); // Green background (hex color)

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; // Add this
    renderer.toneMappingExposure = 1; // And this

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size, size),
      0.5, // strength - increased but not too high
      0.75, // radius
      0.46
    );

    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);
    bloomComposer.addPass(new OutputPass());

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    const uniforms = {
      u_time: { value: 0.0 },
      u_frequency: { value: 0.0 },
      u_red: { value: 0.0 }, // Red
      u_green: { value: 0.0 }, // Green
      u_blue: { value: 1.0 }, // Blue
    };

    const material = new THREE.ShaderMaterial({
      wireframe: true,
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const geo = new THREE.IcosahedronGeometry(4, 5);
    const mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);
    camera.position.z = 8;

    const clock = new THREE.Clock();

    function animate() {
      uniforms.u_time.value = clock.getElapsedTime();

      if (analyser) {
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        const average = freqData.reduce((a, b) => a + b) / freqData.length;

        uniforms.u_frequency.value = average;

        // Normalize the average amplitude to a range [0, 1] (assuming 255 max)
        const intensity = Math.min(average / 255, 1);

        // Adjust colors: more intensity shifts the color toward white
        uniforms.u_red.value = 0.2 + 0.8 * intensity; // Base red + intensity scaling
        uniforms.u_green.value = 0.1 + 0.6 * intensity; // Base green + intensity scaling
        uniforms.u_blue.value = 0.8 + 0.2 * intensity; // Base blue + intensity scaling
      }

      // Rotate mesh a small amount
      mesh.rotation.x += 0.01;
      mesh.rotation.y += 0.01;

      bloomComposer.render();
      animationRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      geo.dispose();
      material.dispose();
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [analyser, color]);

  return (
    <div
      ref={containerRef}
      className="w-full aspect-square bg-transparent rounded-full overflow-hidden"
    />
  );
}
