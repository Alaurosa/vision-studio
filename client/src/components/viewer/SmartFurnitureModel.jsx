import React, { Suspense, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import ProceduralFurniture from './ProceduralFurniture';
import { resolveFurnitureModelUrl, resolveProceduralCategory } from '@/utils/furniture3d';

/**
 * SmartFurnitureModel — renders a furniture item in 3D.
 *
 * Priority:
 *   1. If model_url / modelUrl is set, load and scale the GLB (errors → procedural).
 *   2. Otherwise, dimensionally accurate procedural shape from category + metadata.
 *
 * External 3D generation APIs are not used here; catalog GLBs and primitives only.
 */

function GLBModel({ url, w, d, h, rotationY = 0 }) {
  const gltf = useLoader(GLTFLoader, url);

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);

    const scaleX = size.x > 0 ? w / size.x : 1;
    const scaleY = size.y > 0 ? h / size.y : 1;
    const scaleZ = size.z > 0 ? d / size.z : 1;
    const uniformScale = Math.min(scaleX, scaleY, scaleZ) * 0.95;
    cloned.scale.setScalar(uniformScale);

    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    // Fully center on the group origin (horizontal AND vertical). The parent
    // group in RoomViewer3D already lifts by fh/2, which puts the bottom on
    // the floor — matching how ProceduralFurniture is positioned.
    cloned.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);

    // Per-item facing override (catalog.model_rotation_y) for one-off
    // Kenney assets that don't face the expected direction.
    cloned.rotation.y = rotationY;

    // Enable shadows on all meshes
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [gltf, w, d, h, rotationY]);

  return <primitive object={scene} />;
}

class ModelErrorBoundary extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export default function SmartFurnitureModel({ item, w, d, h, color }) {
  const proceduralCategory = resolveProceduralCategory(item);
  const fallback = (
    <ProceduralFurniture category={proceduralCategory} w={w} d={d} h={h} color={color} />
  );

  const modelUrl = resolveFurnitureModelUrl(item);
  if (!modelUrl) return fallback;

  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GLBModel
          url={modelUrl}
          w={w}
          d={d}
          h={h}
          rotationY={item.model_rotation_y || 0}
        />
      </Suspense>
    </ModelErrorBoundary>
  );
}
