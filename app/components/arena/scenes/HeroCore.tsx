"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const ACCENT = "#00E7FF";

function CoreSphere() {
  const ref = useRef<THREE.Group>(null);
  const surfaceRef = useRef<THREE.Points>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const innerHaloRef = useRef<THREE.Mesh>(null);
  const outerHaloRef = useRef<THREE.Mesh>(null);
  const streamsRef = useRef<THREE.LineSegments>(null);

  // Surface points (lat/lon grid)
  const surfacePositions = useMemo(() => {
    const arr: number[] = [];
    const segments = 60;
    const radius = 1.4;
    for (let i = 0; i <= segments; i++) {
      const phi = (i / segments) * Math.PI;
      for (let j = 0; j < segments; j++) {
        const theta = (j / segments) * Math.PI * 2;
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        arr.push(x, y, z);
      }
    }
    return new Float32Array(arr);
  }, []);

  // Data streams (entering/exiting the core)
  const streamGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const segments = 12;
    const count = segments * 2 * 3; // start/end pairs
    const positions = new Float32Array(count * 6); // 2 endpoints × 3 coords
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const start = new THREE.Vector3(Math.cos(theta) * 4.5, -2.6, Math.sin(theta) * 4.5);
      const end = new THREE.Vector3(0, 0, 0);
      positions.set([start.x, start.y, start.z, end.x, end.y, end.z], i * 6);
    }
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 0.08;
      ref.current.rotation.x = Math.sin(t * 0.04) * 0.12;
    }
    if (surfaceRef.current) {
      const m = surfaceRef.current.material as THREE.PointsMaterial;
      m.opacity = 0.42 + Math.sin(t * 0.6) * 0.08;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.12;
    }
    if (innerHaloRef.current) {
      const s = 1 + Math.sin(t * 0.9) * 0.04;
      innerHaloRef.current.scale.setScalar(s);
    }
    if (outerHaloRef.current) {
      const s = 1 + Math.cos(t * 0.7) * 0.06;
      outerHaloRef.current.scale.setScalar(s);
    }
    if (streamsRef.current) {
      const m = streamsRef.current.material as THREE.LineBasicMaterial;
      m.opacity = 0.35 + Math.sin(t * 1.4) * 0.15;
    }
  });

  return (
    <group ref={ref}>
      {/* Lat/Lon surface grid */}
      <points ref={surfaceRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[surfacePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={ACCENT}
          size={0.012}
          transparent
          opacity={0.5}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* Central core — small dark sphere */}
      <mesh>
        <icosahedronGeometry args={[0.55, 2]} />
        <meshBasicMaterial color="#02101a" />
      </mesh>

      {/* Inner halo */}
      <mesh ref={innerHaloRef}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>

      {/* Outer halo */}
      <mesh ref={outerHaloRef}>
        <sphereGeometry args={[1.55, 32, 32]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.025} side={THREE.BackSide} />
      </mesh>

      {/* Equatorial ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.62, 1.66, 96]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Streams */}
      <lineSegments ref={streamsRef}>
        <primitive object={streamGeometry} attach="geometry" />
        <lineBasicMaterial color={ACCENT} transparent opacity={0.4} />
      </lineSegments>
    </group>
  );
}

export default function HeroCore() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0.3, 4.4], fov: 38 }}
    >
      <ambientLight intensity={0.4} />
      <CoreSphere />
    </Canvas>
  );
}
