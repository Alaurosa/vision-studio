import axios from 'axios';

const MESHY_BASE = 'https://api.meshy.ai/openapi/v1';
const headers = () => ({ Authorization: `Bearer ${process.env.MESHY_API_KEY}` });

export async function submitImageTo3D(image_url, options = {}) {
  if (!process.env.MESHY_API_KEY) {
    console.warn('MESHY_API_KEY not set — skipping 3D generation');
    return null;
  }
  const { data } = await axios.post(
    `${MESHY_BASE}/image-to-3d`,
    {
      image_url,
      enable_pbr: true,
      ai_model: 'meshy-4',
      topology: 'quad',
      target_polycount: 8000,
      ...options,
    },
    { headers: headers() }
  );
  return data.result;
}

export async function pollMeshyTask(taskId, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 5000));
    const { data } = await axios.get(`${MESHY_BASE}/image-to-3d/${taskId}`, { headers: headers() });
    if (data.status === 'SUCCEEDED') {
      return {
        glb_url: data.model_urls?.glb,
        fbx_url: data.model_urls?.fbx,
        thumbnail_url: data.thumbnail_url,
      };
    }
    if (data.status === 'FAILED') throw new Error(`Meshy task ${taskId} failed`);
  }
  throw new Error('Meshy task timed out');
}

export async function generateFurnitureModel(image_url) {
  const taskId = await submitImageTo3D(image_url);
  if (!taskId) return null;
  return await pollMeshyTask(taskId);
}
