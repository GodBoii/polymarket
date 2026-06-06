"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 1800;

function Particles({ collapse }: { collapse: number }) {
  const ref = useRef<THREE.Points>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);

  const startPositions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = 4 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    const positions = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;
    const k = collapse; // 0..1
    const ease = k * k * k; // ease-in cubic
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const sx = startPositions[i * 3 + 0];
      const sy = startPositions[i * 3 + 1];
      const sz = startPositions[i * 3 + 2];
      arr[i * 3 + 0] = sx * (1 - ease) + (Math.random() - 0.5) * 0.05 * ease;
      arr[i * 3 + 1] = sy * (1 - ease) + (Math.random() - 0.5) * 0.05 * ease;
      arr[i * 3 + 2] = sz * (1 - ease) + (Math.random() - 0.5) * 0.05 * ease;
    }
    positions.needsUpdate = true;
    const m = ref.current.material as THREE.PointsMaterial;
    m.opacity = 0.65 * (1 - ease) + 0.1;
    if (ringARef.current) {
      const s = 1 + (t - 2) * 0.6;
      ringARef.current.scale.setScalar(Math.max(0.01, s));
      const mat = ringARef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.5 - Math.max(0, t - 2) * 0.18);
    }
    if (ringBRef.current) {
      const s = 1 + (t - 3) * 0.5;
      ringBRef.current.scale.setScalar(Math.max(0.01, s));
      const mat = ringBRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.4 - Math.max(0, t - 3) * 0.15);
    }
  });

  return (
    <>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[startPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.025} transparent opacity={0.6} sizeAttenuation depthWrite={false} />
      </points>
      <mesh ref={ringARef}>
        <ringGeometry args={[0.5, 0.52, 96]} />
        <meshBasicMaterial color="#00E7FF" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringBRef}>
        <ringGeometry args={[0.5, 0.52, 96]} />
        <meshBasicMaterial color="#00E7FF" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

export default function FinalCollapse() {
  const [collapse, setCollapse] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress 0..1 as the section enters and the user scrolls
      const progress = Math.max(0, Math.min(1, 1 - r.top / vh));
      setCollapse(progress);
    };
    const loop = () => {
      onScroll();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className="absolute inset-0">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0, 5.5], fov: 55 }}>
        <Particles collapse={collapse} />
      </Canvas>
    </div>
  );
}
