"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const NODE_COUNT = 2200;
const SIGNAL_COUNT = 50;

function Field() {
  const nodesRef = useRef<THREE.Points>(null);
  const signalsRef = useRef<THREE.Points>(null);

  // Pre-compute static positions
  const { nodePositions, nodePhases, signalData } = useMemo(() => {
    const nodes = new Float32Array(NODE_COUNT * 3);
    const phases = new Float32Array(NODE_COUNT);
    for (let i = 0; i < NODE_COUNT; i++) {
      const r = 8 + Math.pow(Math.random(), 0.6) * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      nodes[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      nodes[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.65;
      nodes[i * 3 + 2] = r * Math.cos(phi) - 4; // push back behind core
      phases[i] = Math.random() * Math.PI * 2;
    }

    const sigStart = new Float32Array(SIGNAL_COUNT * 3);
    const sigVel = new Float32Array(SIGNAL_COUNT * 3);
    for (let i = 0; i < SIGNAL_COUNT; i++) {
      // Pick a random start on a sphere of radius 22
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 20 + Math.random() * 6;
      sigStart[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      sigStart[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.65;
      sigStart[i * 3 + 2] = r * Math.cos(phi) - 4;
      // Velocity points toward the center
      const v = new THREE.Vector3(-sigStart[i * 3 + 0], -sigStart[i * 3 + 1], -sigStart[i * 3 + 2] - 4)
        .normalize()
        .multiplyScalar(0.6 + Math.random() * 0.9);
      sigVel[i * 3 + 0] = v.x;
      sigVel[i * 3 + 1] = v.y;
      sigVel[i * 3 + 2] = v.z;
    }
    return { nodePositions: nodes, nodePhases: phases, signalData: { sigStart, sigVel } };
  }, []);

  const nodeMaterial = useMemo(
    () => new THREE.PointsMaterial({ color: "#ffffff", size: 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false }),
    [],
  );
  const signalMaterial = useMemo(
    () => new THREE.PointsMaterial({ color: "#00E7FF", size: 0.11, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (nodesRef.current) {
      nodeMaterial.opacity = 0.45 + Math.sin(t * 0.5) * 0.1;
    }
    if (signalsRef.current) {
      const positions = signalsRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const arr = positions.array as Float32Array;
      for (let i = 0; i < SIGNAL_COUNT; i++) {
        arr[i * 3 + 0] = signalData.sigStart[i * 3 + 0] + signalData.sigVel[i * 3 + 0] * t;
        arr[i * 3 + 1] = signalData.sigStart[i * 3 + 1] + signalData.sigVel[i * 3 + 1] * t;
        arr[i * 3 + 2] = signalData.sigStart[i * 3 + 2] + signalData.sigVel[i * 3 + 2] * t;
      }
      positions.needsUpdate = true;
      signalMaterial.opacity = 0.7 + Math.sin(t * 1.8) * 0.2;
    }
  });

  // Initial signal positions (one shot)
  const initialSignalPositions = useMemo(() => {
    return signalData.sigStart;
  }, [signalData]);

  return (
    <>
      <points ref={nodesRef} material={nodeMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nodePositions, 3]} />
        </bufferGeometry>
      </points>
      <points ref={signalsRef} material={signalMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initialSignalPositions, 3]} />
        </bufferGeometry>
      </points>
    </>
  );
}

export default function PredictionNodeField() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 0], fov: 75 }}
    >
      <Field />
    </Canvas>
  );
}
