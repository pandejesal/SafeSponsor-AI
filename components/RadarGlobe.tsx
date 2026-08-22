'use client';

import { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function GlobePoints({ dark }: { dark: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  const positions = useMemo(() => {
    const N = 800;
    const arr = new Float32Array(N * 3);
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = phi * i;
      arr[i * 3] = Math.cos(th) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(th) * r;
    }
    return arr;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.08;
    if (ring.current) ring.current.rotation.z += delta * 0.18;
    if (ring2.current) ring2.current.rotation.x += delta * 0.12;
  });

  const ptColor = dark ? '#F6F2EF' : '#0F1B2E';
  const ringColor = '#49A9DE';

  return (
    <group ref={group}>
      <points geometry={geo}>
        <pointsMaterial
          color={ptColor}
          size={0.018}
          sizeAttenuation
          transparent
          opacity={0.7}
        />
      </points>

      {/* Scan ring 1 — horizontal */}
      <mesh ref={ring} rotation={[0.3, 0, 0]}>
        <torusGeometry args={[1.12, 0.005, 6, 128]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.45} />
      </mesh>

      {/* Scan ring 2 — tilted */}
      <mesh ref={ring2} rotation={[1.2, 0.5, 0]}>
        <torusGeometry args={[1.08, 0.004, 6, 128]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function FallbackLoader() {
  return null;
}

export function RadarGlobe({ isDark }: { isDark: boolean }) {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // IntersectionObserver — pause when offscreen
  useEffect(() => {
    if (reducedMotion) { setPaused(true); return; }
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setPaused(!e.isIntersecting),
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  return (
    <div ref={containerRef} className="w-full h-[300px] rounded-[16px] overflow-hidden" style={{ background: isDark ? 'rgba(15,27,46,0.04)' : 'rgba(246,242,239,0.5)' }}>
      <Suspense fallback={<FallbackLoader />}>
        <Canvas
          frameloop={paused ? 'never' : 'always'}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          camera={{ position: [0, 0, 2.6], fov: 35 }}
          style={{ background: 'transparent' }}
        >
          <GlobePoints dark={isDark} />
        </Canvas>
      </Suspense>
    </div>
  );
}
