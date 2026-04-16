/**
 * ProductTexture — loads a catalog image through the CORS-enabled proxy and
 * returns a THREE texture ready for use as a material map. Returns null while
 * loading or on failure so callers can fall back to flat color.
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';

const textureCache = new Map(); // url -> Promise<Texture|null>

function loadThrough(proxyUrl) {
  if (textureCache.has(proxyUrl)) return textureCache.get(proxyUrl);

  const promise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      proxyUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        resolve(tex);
      },
      undefined,
      () => resolve(null),
    );
  });
  textureCache.set(proxyUrl, promise);
  return promise;
}

/**
 * Hook: returns a THREE.Texture or null. Pass the raw external image URL.
 * Routes through the server's /api/proxy-image endpoint to avoid CORS taint.
 */
export function useProductTexture(imageUrl) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (!imageUrl) { setTexture(null); return; }
    let cancelled = false;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const proxyUrl = `${apiBase}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    loadThrough(proxyUrl).then((tex) => {
      if (!cancelled) setTexture(tex);
    });
    return () => { cancelled = true; };
  }, [imageUrl]);

  return texture;
}

// Categories where the product photo reads naturally as a front-face decal.
const FRONT_FACE_CATEGORIES = new Set([
  'bookshelf', 'dresser', 'nightstand', 'tv_stand', 'cabinet',
]);

/**
 * ProductBillboard — shows the actual product photo on or above a piece of
 * furniture so the user recognizes the exact IKEA/Ashley item in 3D.
 *
 * Strategy by category:
 *   - Cabinetry (bookshelf, dresser, nightstand, tv_stand, cabinet): decal
 *     mapped onto the front face — matches how catalog photos are framed.
 *   - Everything else (sofa, bed, chair, tables, desk): a camera-facing
 *     Billboard floating just above the model, so users see the real product
 *     from any viewing angle without occluding the procedural geometry.
 */
export function ProductBillboard({ imageUrl, category, w, d, h }) {
  const texture = useProductTexture(imageUrl);
  if (!texture) return null;

  // Cabinetry: front-face decal at z = +d/2
  if (FRONT_FACE_CATEGORIES.has(category)) {
    // Use the image's aspect ratio, fit inside the front face with slight margin.
    const image = texture.image;
    const imgAspect = image && image.width ? image.width / image.height : 1;
    const maxW = w * 0.92;
    const maxH = h * 0.92;
    let pw = maxW;
    let ph = pw / imgAspect;
    if (ph > maxH) { ph = maxH; pw = ph * imgAspect; }
    return (
      <mesh position={[0, h / 2, d / 2 + 0.002]}>
        <planeGeometry args={[pw, ph]} />
        <meshStandardMaterial
          map={texture}
          transparent
          opacity={0.95}
          roughness={0.6}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
    );
  }

  // Seating / beds / tables: camera-facing floating billboard above the item.
  const image = texture.image;
  const imgAspect = image && image.width ? image.width / image.height : 1.2;
  const labelH = Math.min(0.55, Math.max(0.3, h * 0.9));
  const labelW = labelH * imgAspect;
  return (
    <Billboard position={[0, h + labelH / 2 + 0.12, 0]} follow lockX={false} lockY={false} lockZ={false}>
      <mesh>
        <planeGeometry args={[labelW, labelH]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </Billboard>
  );
}
