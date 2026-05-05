import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useLayoutStore } from '@/store/layoutStore';

const isDraftId = (id) => typeof id === 'string' && id.startsWith('draft-');

/** Shared JSON/SVG/DXF export used by editor sidebar (and legacy callers). */
export function useRoomExport() {
  const [exporting, setExporting] = useState(false);
  const room = useLayoutStore((s) => s.room);
  const furniture = useLayoutStore((s) => s.furniture);

  const runExport = async (format) => {
    if (!room?.id) return;
    setExporting(true);
    try {
      let blob;
      const draft = isDraftId(room.id);
      if (draft) {
        const payload = {
          room_context: {
            id: room.id,
            name: room.name,
            width: room.width,
            depth: room.depth,
            height: room.height || 96,
            unit: room.unit || 'inches',
            walls: room.walls || [],
          },
          placements_context: furniture.map((f) => ({
            id: f.id,
            name: f.name,
            category: f.category,
            provider: f.provider,
            provider_id: f.provider_id,
            width: f.width,
            depth: f.depth,
            height: f.height,
            x_inches: f.x_inches,
            y_inches: f.y_inches,
            rotation: f.rotation,
            color: f.color,
            custom: f.custom,
            model_url: f.model_url,
          })),
        };
        const res = await api.post(`/api/export/${format}/draft`, payload, { responseType: 'blob' });
        blob = res.data;
      } else {
        const res = await api.post(`/api/export/${format}/${room.id}`, {}, { responseType: 'blob' });
        blob = res.data;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(room.name || 'layout').replace(/\s+/g, '_')}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${format.toUpperCase()} successfully`);
    } catch (e) {
      toast.error(`Export failed — ${e?.response?.data?.error || e.message}`);
    } finally {
      setExporting(false);
    }
  };

  return { runExport, exporting, roomReady: Boolean(room?.id) };
}
