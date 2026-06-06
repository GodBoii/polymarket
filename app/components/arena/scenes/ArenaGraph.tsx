"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const ACCENT = "#00E7FF";

type Opponent = {
  id: string;
  name: string;
  intensity: number; // 0..1, brightness factor
};

const AGENTS: { id: string; name: string; pos: [number, number, number]; radius: number; isUs?: boolean }[] = [
  { id: "poly",      name: "POLY",  pos: [0, 0, 0],       radius: 0.55, isUs: true },
  { id: "tide",      name: "TIDE",  pos: [2.4, 0.6, 0.2], radius: 0.32 },
  { id: "keel",      name: "KEEL",  pos: [-2.2, 0.8, 0.4], radius: 0.30 },
  { id: "parallax",  name: "PRLX",  pos: [1.2, -1.8, 0.3], radius: 0.26 },
  { id: "ledger",    name: "LDGR",  pos: [-1.4, -1.6, 0.3], radius: 0.24 },
];

const EDGES: { from: string; to: string }[] = [
  { from: "poly", to: "tide" }, { from: "poly", to: "keel" },
  { from: "poly", to: "parallax" }, { from: "poly", to: "ledger" },
  { from: "tide", to: "keel" }, { from: "tide", to: "parallax" },
  { from: "tide", to: "ledger" }, { from: "keel", to: "parallax" },
  { from: "keel", to: "ledger" }, { from: "parallax", to: "ledger" },
];

function Scene({ intensity }: { intensity: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const usRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const signalsRef = useRef<THREE.Points>(null);

  // Pre-compute signal start/end and per-edge data
  const edgeData = useMemo(() => {
    const positions: number[] = [];
    EDGES.forEach((e) => {
      const a = AGENTS.find((g) => g.id === e.from)!;
      const b = AGENTS.find((g) => g.id === e.to)!;
      positions.push(a.pos[0], a.pos[1], a.pos[2], b.pos[0], b.pos[1], b.pos[2]);
    });
    return new Float32Array(positions);
  }, []);

  // Per-opponent dim factor (based on "intensity" from scroll)
  const dims = useMemo(() => {
    return AGENTS.map((a) => {
      if (a.isUs) return 1;
      // Light up rivals that are still in the running; fade others
      if (a.id === "ledger" || a.id === "parallax") return 0.18 + intensity * 0.12;
      return 0.6 + intensity * 0.4;
    });
  }, [intensity]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.18) * 0.18;
    }
    if (usRef.current) {
      usRef.current.rotation.y = t * 0.4;
      usRef.current.rotation.x = t * 0.2;
    }
    if (haloRef.current) {
      const s = 1 + Math.sin(t * 0.8) * 0.06;
      haloRef.current.scale.setScalar(s);
    }
    if (edgesRef.current) {
      const m = edgesRef.current.material as THREE.LineBasicMaterial;
      m.opacity = 0.35 + Math.sin(t * 1.2) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central US agent — icosahedron with halo */}
      <mesh ref={usRef}>
        <icosahedronGeometry args={[0.55, 2]} />
        <meshBasicMaterial color={ACCENT} wireframe />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.95, 32, 32]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Opponent nodes */}
      {AGENTS.filter((a) => !a.isUs).map((a, i) => (
        <group key={a.id} position={a.pos}>
          <mesh>
            <icosahedronGeometry args={[a.radius, 1]} />
            <meshBasicMaterial color={ACCENT} wireframe transparent opacity={dims[i + 1]} />
          </mesh>
          <mesh>
            <sphereGeometry args={[a.radius * 0.55, 16, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={dims[i + 1] * 0.85} />
          </mesh>
        </group>
      ))}

      {/* Edges */}
      <lineSegments ref={edgesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edgeData, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={ACCENT} transparent opacity={0.4} />
      </lineSegments>
    </group>
  );
}

export default function ArenaGraph() {
  const [intensity, setIntensity] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (!ref.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const r = ref.current.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0..1 over the section lifetime
      const p = Math.max(0, Math.min(1, 1 - (r.top + r.height * 0.4) / vh));
      setIntensity(p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className="absolute inset-0">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0, 6.5], fov: 50 }}>
        <Scene intensity={intensity} />
      </Canvas>
    </div>
  );
}
