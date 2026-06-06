// Make @react-three/fiber's intrinsic JSX elements (mesh, group, etc.) known to TS.
// React 19 uses the new JSX namespace under React.JSX, so we augment both for safety.
import "react";
import "react/jsx-runtime";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      points: any;
      line: any;
      lineLoop: any;
      ambientLight: any;
      directionalLight: any;
      perspectiveCamera: any;
      primitive: any;
      sphereGeometry: any;
      bufferGeometry: any;
      bufferAttribute: any;
      pointsMaterial: any;
      meshBasicMaterial: any;
      lineBasicMaterial: any;
      ringGeometry: any;
      foreignObject: any;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      points: any;
      line: any;
      lineLoop: any;
      ambientLight: any;
      directionalLight: any;
      perspectiveCamera: any;
      primitive: any;
      sphereGeometry: any;
      bufferGeometry: any;
      bufferAttribute: any;
      pointsMaterial: any;
      meshBasicMaterial: any;
      lineBasicMaterial: any;
      ringGeometry: any;
      foreignObject: any;
    }
  }
}

export {};
