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

  const { object, scale } = useMemo(() => {
    const cloned = gltf.scene.clone(true);

    // Apply the per-item facing override (catalog.model_rotation_y) FIRST and
    // measure in that final orientation, so width/depth map to the right axes.
    // The non-uniform scale is applied by the wrapper <group> *after* this
    // rotation, which keeps the mesh from shearing.
    cloned.rotation.y = rotationY;
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Center on X/Z and drop the bottom to Y=0 so the piece sits on the floor
    // (the parent furniture group sits at floor level, like ProceduralFurniture).
    cloned.position.set(-center.x, -box.min.y, -center.z);

    // Enable shadows on all meshes
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Scale each axis to the real catalog size so the model fills its true
    // footprint and height and matches the 2D footprint exactly — no min()
    // shrink, no 0.95 fudge, and (because height is exact) no floating.
    const scaleX = size.x > 0 ? w / size.x : 1;
    const scaleY = size.y > 0 ? h / size.y : 1;
    const scaleZ = size.z > 0 ? d / size.z : 1;
    return { object: cloned, scale: [scaleX, scaleY, scaleZ] };
  }, [gltf, w, d, h, rotationY]);

  return (
    <group scale={scale}>
      <primitive object={object} />
    </group>
  );
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
    <ModelErrorBoundary key={modelUrl} fallback={fallback}>
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
