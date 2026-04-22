import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import api from '@/lib/api';
import { useLayoutStore } from '@/store/layoutStore';

const modelCache = new Map();

function ProceduralFallback({ w, d, h, color }) {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

function GLBModel({ url, w, d, h }) {
  const gltf = useLoader(GLTFLoader, url);

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scaleX = size.x > 0 ? w / size.x : 1;
    const scaleY = size.y > 0 ? h / size.y : 1;
    const scaleZ = size.z > 0 ? d / size.z : 1;
    const uniformScale = Math.min(scaleX, scaleY, scaleZ) * 0.95;
    cloned.scale.setScalar(uniformScale);

    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    cloned.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
    return cloned;
  }, [gltf, w, d, h]);

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
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function SmartFurnitureModel({ item, w, d, h, color }) {
  const [glbUrl, setGlbUrl] = useState(item.model_url || null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const updateFurniture = useLayoutStore((state) => state.updateFurniture);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (item.model_url) {
      setGlbUrl(item.model_url);
      return;
    }
    if (!item.image_url || !item.id) return;

    const cached = modelCache.get(item.image_url);
    if (cached?.status === 'ready') {
      setGlbUrl(cached.glb_url);
      return;
    }
    if (cached?.status === 'pending') {
      setLoading(true);
      pollForModel(item.image_url, cached.task_id, item.id);
      return;
    }
    if (cached?.status === 'failed' || cached?.status === 'unavailable') {
      return;
    }

    triggerGeneration(item.image_url, item.catalog_id, item.name, item.id);
  }, [item.id, item.image_url, item.model_url]);

  const persistModel = (url, itemId) => {
    setGlbUrl(url);
    updateFurniture(itemId, { model_url: url });
  };

  const triggerGeneration = async (imageUrl, catalogId, name, itemId) => {
    try {
      setLoading(true);
      const { data } = await api.post('/api/models/generate', {
        image_url: imageUrl,
        catalog_id: catalogId,
        name: name,
      });

      if (!mountedRef.current) return;

      if (data.status === 'ready' && data.glb_url) {
        modelCache.set(imageUrl, { status: 'ready', glb_url: data.glb_url });
        persistModel(data.glb_url, itemId);
        setLoading(false);
        return;
      }

      if (data.status === 'pending' && data.task_id) {
        modelCache.set(imageUrl, { status: 'pending', task_id: data.task_id });
        pollForModel(imageUrl, data.task_id, itemId);
        return;
      }

      modelCache.set(imageUrl, { status: data.status || 'unavailable' });
      setLoading(false);
    } catch {
      modelCache.set(imageUrl, { status: 'failed' });
      if (mountedRef.current) setLoading(false);
    }
  };

  const pollForModel = async (imageUrl, taskId, itemId) => {
    for (let attempt = 0; attempt < 36; attempt += 1) {
      try {
        const { data } = await api.get(`/api/models/status/${taskId}`);
        if (!mountedRef.current) return;

        if (data.status === 'ready' && data.glb_url) {
          modelCache.set(imageUrl, { status: 'ready', glb_url: data.glb_url });
          persistModel(data.glb_url, itemId);
          setLoading(false);
          return;
        }

        if (data.status === 'failed' || data.status === 'unavailable') {
          modelCache.set(imageUrl, { status: data.status });
          setLoading(false);
          return;
        }
      } catch {
        // Keep polling.
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    modelCache.set(imageUrl, { status: 'failed' });
    if (mountedRef.current) setLoading(false);
  };

  if (!glbUrl) {
    return (
      <group>
        <ProceduralFallback w={w} d={d} h={h} color={color} />
        {loading && (
          <mesh position={[0, h + 0.04, 0]}>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshStandardMaterial color="#c58d45" emissive="#c58d45" emissiveIntensity={0.6} />
          </mesh>
        )}
      </group>
    );
  }

  return (
    <ModelErrorBoundary fallback={<ProceduralFallback w={w} d={d} h={h} color={color} />}>
      <Suspense fallback={<ProceduralFallback w={w} d={d} h={h} color={color} />}>
        <GLBModel url={glbUrl} w={w} d={d} h={h} />
      </Suspense>
    </ModelErrorBoundary>
  );
}