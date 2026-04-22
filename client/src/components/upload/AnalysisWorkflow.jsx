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

/**
 * AnalysisWorkflow runs the floor-plan upload + AI parse pipeline
 * and calls onComplete(room, parseResult, imageUrl) when finished.
 */
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

      // 3. Build image URL for the room editor
      // The server returns floor_plan_url which may be a Supabase URL or a local path
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      let imageUrl = data?.floor_plan_url || '';
      if (imageUrl.startsWith('/uploads/')) {
        imageUrl = `${baseUrl}${imageUrl}`;
      }
      // Fallback: use the local file preview URL
      if (!imageUrl) {
        imageUrl = URL.createObjectURL(file);
      }

      const parseResult = data?.parse_result || {};

      await new Promise((r) => setTimeout(r, 400));

      // Pass room, parseResult, and imageUrl to parent for the room editor
      onComplete?.(room, parseResult, imageUrl);
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
