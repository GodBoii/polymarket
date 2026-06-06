"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type City = { name: string; lat: number; lon: number };

// Convert lat/lon (degrees) to 3D unit vector
function latLonToVec3(lat: number, lon: number, r = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

const CITIES: City[] = [
  { name: "London", lat: 51.5074, lon: -0.1278 },
  { name: "Madrid", lat: 40.4168, lon: -3.7038 },
  { name: "Buenos Aires", lat: -34.6037, lon: -58.3816 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Paris", lat: 48.8566, lon: 2.3522 },
  { name: "Berlin", lat: 52.52, lon: 13.405 },
  { name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729 },
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { name: "Lagos", lat: 6.5244, lon: 3.3792 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093 },
  { name: "Cairo", lat: 30.0444, lon: 31.2357 },
  { name: "Mexico City", lat: 19.4326, lon: -99.1332 },
  { name: "Istanbul", lat: 41.0082, lon: 28.9784 },
  { name: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Seoul", lat: 37.5665, lon: 126.978 },
  { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
  { name: "Moscow", lat: 55.7558, lon: 37.6173 },
  { name: "Toronto", lat: 43.6532, lon: -79.3832 },
  { name: "Dubai", lat: 25.2048, lon: 55.2708 },
];

// Procedural "land" point cloud — continent-masked Fibonacci lattice.
function buildLandPoints(count = 1600) {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const continents = [
    { lat: 50, lon: 10, r: 35 },
    { lat: 20, lon: 80, r: 30 },
    { lat: 35, lon: 100, r: 32 },
    { lat: -10, lon: -55, r: 38 },
    { lat: 25, lon: -100, r: 35 },
    { lat: 0, lon: 20, r: 32 },
    { lat: -25, lon: 135, r: 22 },
  ];
  let attempts = 0;
  while (pts.length < count && attempts < count * 8) {
    attempts++;
    const i = pts.length + attempts;
    const y = 1 - (i / (count * 1.4)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const v = new THREE.Vector3(x, y, z);
    const lat = (Math.asin(v.y) * 180) / Math.PI;
    const lon = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180;
    const onLand = continents.some((c) => {
      const dLat = Math.abs(lat - c.lat);
      const dLon = Math.abs(((lon - c.lon + 540) % 360) - 180);
      return Math.sqrt(dLat * dLat + dLon * dLon) < c.r;
    });
    if (onLand) pts.push(v);
  }
  return pts;
}

function makeArc(start: THREE.Vector3, end: THREE.Vector3, segments = 96, lift = 0.35) {
  const distance = start.angleTo(end);
  const positions: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = start.clone().lerp(end, t);
    const sin = Math.sin(t * Math.PI);
    a.multiplyScalar(1 + sin * lift * distance * 0.6);
    positions.push(a.x, a.y, a.z);
  }
  return positions;
}

type ArcData = { positions: number[]; speed: number; color: THREE.Color; phase: number };
type HaloData = { base: number; speed: number; phase: number };

function Globe() {
  const group = useRef<THREE.Group>(null);
  const arcMatRefs = useRef<Array<THREE.LineBasicMaterial | null>>([]);
  const haloMatRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([]);

  const landPoints = useMemo(() => buildLandPoints(1600), []);
  const cityPositions = useMemo(
    () => CITIES.map((c) => ({ ...c, v: latLonToVec3(c.lat, c.lon, 1.0) })),
    [],
  );

  const arcs = useMemo<ArcData[]>(() => {
    const palette = [
      new THREE.Color("#00E5FF"),
      new THREE.Color("#00FF88"),
      new THREE.Color("#FFD166"),
      new THREE.Color("#9bdcff"),
    ];
    const list: ArcData[] = [];
    for (let i = 0; i < 26; i++) {
      const a = Math.floor(Math.random() * CITIES.length);
      let b = Math.floor(Math.random() * CITIES.length);
      if (b === a) b = (b + 1) % CITIES.length;
      const positions = makeArc(
        latLonToVec3(CITIES[a].lat, CITIES[a].lon, 1.001),
        latLonToVec3(CITIES[b].lat, CITIES[b].lon, 1.001),
        96,
        0.38,
      );
      list.push({
        positions,
        speed: 0.18 + Math.random() * 0.22,
        color: palette[Math.floor(Math.random() * palette.length)],
        phase: Math.random(),
      });
    }
    return list;
  }, []);

  const halos = useMemo<Array<{ city: { v: THREE.Vector3 }; data: HaloData }>>(() => {
    return cityPositions.slice(0, 7).map((c, i) => ({
      city: c,
      data: {
        base: 0.55,
        speed: 0.22 + i * 0.05,
        phase: i * 0.4,
      },
    }));
  }, [cityPositions]);

  const wireSphere = useMemo(() => new THREE.SphereGeometry(1.0, 36, 24), []);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.055;
    }
    const t = state.clock.elapsedTime;
    arcMatRefs.current.forEach((mat, idx) => {
      if (!mat) return;
      const arc = arcs[idx];
      const local = (t * arc.speed + arc.phase) % 1;
      mat.opacity = Math.sin(local * Math.PI) * 0.95;
    });
    haloMatRefs.current.forEach((mat, idx) => {
      if (!mat) return;
      const h = halos[idx].data;
      const local = ((t * h.speed) + h.phase) % 1;
      mat.opacity = h.base * (1 - local) * 0.9;
      const scale = 1 + local * 1.9;
      const mesh = mat as unknown as { __ringMesh?: THREE.Mesh };
      if (mesh.__ringMesh) mesh.__ringMesh.scale.setScalar(scale);
    });
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <group ref={group} rotation={[0.35, 0, 0]}>
        <mesh>
          <primitive object={wireSphere} attach="geometry" />
          <meshBasicMaterial color="#1a2a35" wireframe transparent opacity={0.32} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.985, 64, 48]} />
          <meshBasicMaterial color="#03070a" transparent opacity={0.88} />
        </mesh>

        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array(landPoints.flatMap((p) => [p.x, p.y, p.z])), 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#00E5FF"
            size={0.012}
            sizeAttenuation
            transparent
            opacity={0.85}
          />
        </points>
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array(
                  landPoints.filter((_, i) => i % 5 === 0).flatMap((p) => [p.x, p.y, p.z]),
                ),
                3,
              ]}
            />
          </bufferGeometry>
          <pointsMaterial color="#00FF88" size={0.014} sizeAttenuation transparent opacity={0.6} />
        </points>

        {cityPositions.map((c) => (
          <group key={c.name} position={[c.v.x, c.v.y, c.v.z]}>
            <mesh>
              <sphereGeometry args={[0.013, 16, 16]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.022, 16, 16]} />
              <meshBasicMaterial color="#00E5FF" transparent opacity={0.32} />
            </mesh>
          </group>
        ))}

        {halos.map((h, idx) => (
          <mesh
            key={`halo-${idx}`}
            position={[h.city.v.x, h.city.v.y, h.city.v.z]}
            rotation={[Math.PI / 2, 0, 0]}
            ref={(m: THREE.Mesh | null) => {
              if (m && haloMatRefs.current[idx]) {
                (haloMatRefs.current[idx] as unknown as { __ringMesh: THREE.Mesh }).__ringMesh = m;
              }
            }}
          >
            <ringGeometry args={[0.024, 0.029, 48]} />
            <meshBasicMaterial
              ref={(m: THREE.MeshBasicMaterial | null) => {
                haloMatRefs.current[idx] = m;
              }}
              color={idx % 3 === 0 ? "#00FF88" : idx % 3 === 1 ? "#00E5FF" : "#FFD166"}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {arcs.map((arc, idx) => {
          const geom = new THREE.BufferGeometry();
          geom.setAttribute("position", new THREE.Float32BufferAttribute(arc.positions, 3));
          const lineObj = new THREE.Line(geom);
          return (
            <primitive key={`arc-${idx}`} object={lineObj}>
              <lineBasicMaterial
                attach="material"
                ref={(m: THREE.LineBasicMaterial | null) => {
                  arcMatRefs.current[idx] = m;
                }}
                color={arc.color}
                transparent
                opacity={0.7}
              />
            </primitive>
          );
        })}
      </group>
    </>
  );
}

export default function HeroGlobe({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className={`globe-wrap ${className}`} aria-hidden>
      {mounted && (
        <Canvas
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          dpr={[1, 2]}
          camera={{ position: [0, 0, 3.4], fov: 42 }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Globe />
        </Canvas>
      )}
    </div>
  );
}
