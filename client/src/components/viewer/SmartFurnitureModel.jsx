/**
 * GLBFurnitureModel — Loads real 3D GLB models from Meshy or catalog model_url.
 * Falls back to procedural models if no GLB is available.
 * Triggers Meshy generation if the item has an image_url but no model_url.
 */
import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import FurnitureModel from './FurnitureModels';
import { ProductBillboard } from './ProductTexture';
import api from '../../lib/api';

// Cache of image_url -> { status, glb_url, taskId }
const modelGenCache = new Map();
// Global flag — once Meshy returns unavailable/failed, skip all future generation calls this session
let meshyDisabled = false;

/**
 * Attempt to load and render a GLB model, scaled to fit the item dimensions.
 */
function GLBModel({ url, w, d, h, color }) {
  const gltf = useLoader(GLTFLoader, url);
  
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    
    // Compute the bounding box of the model
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Scale to fit the target dimensions (w, h, d are in meters)
    const scaleX = size.x > 0 ? w / size.x : 1;
    const scaleY = size.y > 0 ? h / size.y : 1;
    const scaleZ = size.z > 0 ? d / size.z : 1;
    const uniformScale = Math.min(scaleX, scaleY, scaleZ) * 0.9; // 90% to leave slight margin
    
    cloned.scale.setScalar(uniformScale);
    
    // Re-center after scaling
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    const scaledSize = new THREE.Vector3();
    scaledBox.getSize(scaledSize);
    
    // Position so bottom is at y=0 and centered on x,z
    cloned.position.set(
      -scaledCenter.x,
      -scaledBox.min.y,
      -scaledCenter.z
    );
    
    return cloned;
  }, [gltf, w, d, h]);

  return <primitive object={scene} />;
}

/**
 * Error boundary for GLB loading failures
 */
class GLBErrorBoundary extends React.PureComponent {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

/**
 * Wrapper that decides between GLB and procedural model.
 * Priority: model_url (pre-generated GLB) > Meshy generate from image_url > procedural
 */
export default function SmartFurnitureModel({ item, w, d, h, color }) {
  const [glbUrl, setGlbUrl] = useState(item.model_url || null);
  const [generating, setGenerating] = useState(false);
  const attemptedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // If item has model_url already, use it directly
  useEffect(() => {
    if (item.model_url) {
      setGlbUrl(item.model_url);
      return;
    }

    // If item has image_url and Meshy is available, try to generate
    if (item.image_url && !attemptedRef.current && !meshyDisabled) {
      attemptedRef.current = true;

      // Check cache first
      const cached = modelGenCache.get(item.image_url);
      if (cached?.status === 'ready') {
        setGlbUrl(cached.glb_url);
        return;
      }
      if (cached?.status === 'failed' || cached?.status === 'unavailable') {
        return; // don't retry per-image failures
      }
      if (cached?.status === 'pending') {
        setGenerating(true);
        pollForModel(item.image_url, cached.taskId);
        return;
      }

      // Trigger generation
      triggerGeneration(item);
    }
  }, [item.model_url, item.image_url]);

  const triggerGeneration = async (item) => {
    try {
      setGenerating(true);
      const { data } = await api.post('/api/models/generate', {
        image_url: item.image_url,
        catalog_id: item.catalog_id,
        name: item.name,
      });
      
      if (!mountedRef.current) return;
      if (data.status === 'ready') {
        modelGenCache.set(item.image_url, { status: 'ready', glb_url: data.glb_url });
        setGlbUrl(data.glb_url);
        setGenerating(false);
      } else if (data.status === 'pending') {
        modelGenCache.set(item.image_url, { status: 'pending', taskId: data.task_id });
        pollForModel(item.image_url, data.task_id);
      } else {
        // unavailable/failed → disable globally so other items don't call the API
        if (data.status === 'unavailable' || data.status === 'failed') {
          meshyDisabled = true;
        }
        modelGenCache.set(item.image_url, { status: data.status || 'failed' });
        setGenerating(false);
      }
    } catch {
      // Network/auth error → disable globally
      meshyDisabled = true;
      if (mountedRef.current) setGenerating(false);
    }
  };

  const pollForModel = async (imageUrl, taskId) => {
    const maxAttempts = 60; // 5 minutes
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      if (!mountedRef.current) return;
      try {
        const { data } = await api.get(`/api/models/status/${taskId}`);
        if (!mountedRef.current) return;
        if (data.status === 'ready') {
          modelGenCache.set(imageUrl, { status: 'ready', glb_url: data.glb_url });
          setGlbUrl(data.glb_url);
          setGenerating(false);
          return;
        }
        if (data.status === 'failed') {
          modelGenCache.set(imageUrl, { status: 'failed' });
          setGenerating(false);
          return;
        }
      } catch {
        // Continue polling
      }
    }
    if (mountedRef.current) setGenerating(false);
  };

  const proceduralFallback = (
    <group>
      <FurnitureModel category={item.category} w={w} d={d} h={h} color={color} />
      {item.image_url && (
        <ProductBillboard imageUrl={item.image_url} category={item.category} w={w} d={d} h={h} />
      )}
    </group>
  );

  // Show procedural model as fallback, with a loading indicator overlay if generating
  if (!glbUrl) {
    return (
      <group>
        {proceduralFallback}
        {generating && (
          <mesh position={[0, h + 0.05, 0]} rotation={[-Math.PI / 4, 0, 0]}>
            <planeGeometry args={[0.15, 0.04]} />
            <meshBasicMaterial color="#7c3aed" transparent opacity={0.85} />
          </mesh>
        )}
      </group>
    );
  }

  // Render GLB with fallback
  return (
    <GLBErrorBoundary fallback={proceduralFallback}>
      <Suspense fallback={proceduralFallback}>
        <GLBModel url={glbUrl} w={w} d={d} h={h} color={color} />
      </Suspense>
    </GLBErrorBoundary>
  );
}
