import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';

const STEPS = [
  { key: 'upload',     label: 'Uploading image',        eyebrow: '01' },
  { key: 'preprocess', label: 'Preprocessing pixels',   eyebrow: '02' },
  { key: 'walls',      label: 'Detecting walls',        eyebrow: '03' },
  { key: 'rooms',      label: 'Segmenting sub-rooms',   eyebrow: '04' },
  { key: 'measure',    label: 'Estimating dimensions',  eyebrow: '05' },
  { key: 'finalize',   label: 'Finalizing geometry',    eyebrow: '06' },
];

function normalizeRoomsToZones(rooms, boundary) {
  const originX = boundary?.x || 0;
  const originY = boundary?.y || 0;
  return rooms.map((room, index) => {
    const polygon = (room.polygon || []).map(([x, y]) => [x - originX, y - originY]);
    const bbox = room.bbox || [];
    const nextBbox = bbox.length === 4
      ? [bbox[0] - originX, bbox[1] - originY, bbox[2] - originX, bbox[3] - originY]
      : bbox;
    return {
      id: room.id || `zone-${index}`,
      name: room.label || `Room ${index + 1}`,
      polygon,
      bbox: nextBbox,
      width: nextBbox.length === 4 ? nextBbox[2] - nextBbox[0] : room.width,
      depth: nextBbox.length === 4 ? nextBbox[3] - nextBbox[1] : room.depth,
      color: room.color || null,
      confidence: room.confidence || null,
    };
  });
}

export default function AnalysisWorkflow({ file, roomName, onComplete, onError }) {
  const [step, setStep] = useState(0);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = async (to) => new Promise((r) => {
    setStep(to);
    setTimeout(r, 650);
  });

  const run = async () => {
    try {
      await advance(0);
      // 1. Create room
      const { data: room } = await api.post('/api/rooms', { name: roomName });

      await advance(1);

      // 2. Upload floorplan → server runs parser
      const fd = new FormData();
      fd.append('file', file);

      // Kick off the request but animate steps in parallel while it resolves
      const req = api.post(`/api/rooms/${room.id}/upload-floorplan`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await advance(2);
      await advance(3);
      await advance(4);

      const { data } = await req;

      await advance(5);

      // 3. Persist detected geometry.  The server returns either:
      //    - parse_result.rooms  = [{ label, polygon, bbox, width, depth }]
      //    - parse_result.walls  = [{ start, end }]
      //    - parse_result.points = [[x,y], ...]  (legacy fallback polygon)
      const pr = data?.parse_result || {};
      const updates = {};
      const boundary = pr.boundary || null;

      if (Array.isArray(pr.rooms) && pr.rooms.length) {
        updates.zones = normalizeRoomsToZones(pr.rooms, boundary);
      } else if (Array.isArray(pr.walls) && pr.walls.length) {
        updates.walls = pr.walls;
      } else if (Array.isArray(pr.points) && pr.points.length) {
        updates.walls = pr.points;
      }
      if (Array.isArray(pr.walls) && pr.walls.length) {
        updates.walls = boundary
          ? pr.walls.map(([x, y]) => [x - boundary.x, y - boundary.y])
          : pr.walls;
      }
      if (pr.scale_px_per_inch) updates.scale_px_per_inch = pr.scale_px_per_inch;
      if (boundary?.w) updates.width = Math.round(boundary.w);
      if (boundary?.h) updates.depth = Math.round(boundary.h);
      if (pr.room_width) updates.width = pr.room_width;
      if (pr.room_depth) updates.depth = pr.room_depth;

      if (Object.keys(updates).length) {
        await api.put(`/api/rooms/${room.id}`, updates).catch((err) => {
          console.warn('Failed to persist parsed geometry:', err?.message);
        });
      }

      await new Promise((r) => setTimeout(r, 500));
      onComplete?.(room);
    } catch (e) {
      console.error(e);
      onError?.(e?.response?.data?.error || e.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-xl w-full mx-6 bg-paper-100 border border-ink-900/10 p-10"
    >
      <div className="eyebrow mb-6">Vision Pipeline</div>
      <h2 className="display-md mb-10">Reading your floorplan…</h2>
      <ol className="space-y-4">
        {STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li key={s.key} className="flex items-start gap-4">
              <span
                className={`mt-1 w-2 h-2 rounded-full transition ${
                  done ? 'bg-ink-900' : active ? 'bg-sienna-500 animate-pulse' : 'bg-ink-300'
                }`}
              />
              <div className="flex-1">
                <div className="eyebrow text-ink-500">{s.eyebrow}</div>
                <div className={`text-base transition ${active ? 'text-ink-900' : done ? 'text-ink-600' : 'text-ink-400'}`}>
                  {s.label}
                </div>
              </div>
              {done && <span className="text-ink-500 text-sm">✓</span>}
            </li>
          );
        })}
      </ol>
    </motion.div>
  );
}
