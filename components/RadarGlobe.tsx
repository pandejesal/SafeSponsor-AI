'use client';

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function GlobePoints({ dark }: { dark: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  const positions = useMemo(() => {
    const N = 600;
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
    if (group.current) group.current.rotation.y += delta * 0.15;
    if (ring.current) ring.current.rotation.z += delta * 0.3;
    if (ring2.current) ring2.current.rotation.x += delta * 0.2;
  });

  const ptColor = dark ? '#CBD5E1' : '#1E3446';

  return (
    <group ref={group}>
      <points geometry={geo}>
        <pointsMaterial
          color={ptColor}
          size={0.045}
          sizeAttenuation
          transparent
          opacity={0.9}
        />
      </points>

      <mesh ref={ring} rotation={[0.3, 0, 0]}>
        <torusGeometry args={[1.15, 0.01, 8, 128]} />
        <meshBasicMaterial color="#49A9DE" transparent opacity={0.6} />
      </mesh>

      <mesh ref={ring2} rotation={[1.2, 0.5, 0]}>
        <torusGeometry args={[1.1, 0.008, 8, 128]} />
        <meshBasicMaterial color="#49A9DE" transparent opacity={0.4} />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="#E07A5F" />
      </mesh>
    </group>
  );
}

function FallbackLoader() {
  return null;
}

export function RadarGlobe({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="w-full h-[320px] rounded-[16px] overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0F1B2E 0%, #16243E 100%)'
          : 'linear-gradient(135deg, #EDE9E3 0%, #F6F2EF 100%)',
      }}
    >
      <Suspense fallback={<FallbackLoader />}>
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [0, 0, 2.8], fov: 32 }}
        >
          <ambientLight intensity={0.5} />
          <GlobePoints dark={isDark} />
        </Canvas>
      </Suspense>
    </div>
  );
}
