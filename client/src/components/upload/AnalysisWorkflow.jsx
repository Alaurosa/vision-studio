import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getApiBaseUrl } from '@/utils/apiBase';

/** Keep raw GPT `rooms` (image pixels) alongside server-normalized `zones`. */
function buildParseResult(apiData, parseResult = {}) {
  const zones = apiData?.zones || parseResult.zones || [];
  const rooms = Array.isArray(parseResult.rooms) && parseResult.rooms.length > 0
    ? parseResult.rooms
    : zones;
  return {
    ...parseResult,
    zones,
    rooms,
    method: apiData?.parse_method || parseResult.method,
    scale_px_per_inch:
      parseResult.scale_px_per_inch ?? apiData?.parse_result?.scale_px_per_inch ?? 1,
  };
}

function notifyParsePipeline(apiData, parseResult) {
  const method = apiData?.parse_method || parseResult?.method || 'unknown';
  const usedOpenAi =
    apiData?.openai_vision === true ||
    (method === 'openai_vision_grid_snap' && !parseResult?.fallback);
  const count = parseResult?.rooms?.length || 0;

  if (method === 'unavailable') {
    toast.error(
      'Floorplan AI is offline. Start Python: cd python && uvicorn app:app --host 0.0.0.0 --port 5001 --reload',
      { duration: 8000 },
    );
    return;
  }

  if (usedOpenAi) {
    toast.success(`AI vision detected ${count} room${count === 1 ? '' : 's'}`, { id: 'parse-method' });
    return;
  }

  if (method === 'opencv' || parseResult?.fallback) {
    const reason = parseResult?.fallback_reason;
    const hint =
      reason === 'missing_openai_api_key'
        ? 'OPENAI_API_KEY missing in root .env (restart Python after adding it).'
        : reason === 'openai_vision_failed_or_empty'
          ? 'OpenAI vision failed — check API key/billing; using rough OpenCV boxes.'
          : 'Using basic OpenCV detection — not the AI grid workflow.';
    toast.error(hint, { duration: 9000, id: 'parse-method' });
  }
}

const STEPS = [
  { key: 'upload',     label: 'Uploading image',        eyebrow: '01' },
  { key: 'preprocess', label: 'Preprocessing pixels',   eyebrow: '02' },
  { key: 'walls',      label: 'Detecting walls',        eyebrow: '03' },
  { key: 'rooms',      label: 'Segmenting interior spaces',   eyebrow: '04' },
  { key: 'measure',    label: 'Estimating dimensions',  eyebrow: '05' },
  { key: 'finalize',   label: 'Finalizing geometry',    eyebrow: '06' },
];

/**
 * AnalysisWorkflow runs the floor-plan upload + AI parse pipeline
 * and calls onComplete(room, parseResult, imageUrl) when finished.
 *
 * When `isGuest` is true it goes through the public, stateless parse endpoint
 * and returns a client-only "draft" room object. Otherwise it uses the
 * authenticated endpoint that creates a server-side room.
 */
export default function AnalysisWorkflow({ file, roomName, isGuest = false, onComplete, onError }) {
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

  const runAuthed = async () => {
    await advance(0);
    const { data: room } = await api.post('/api/rooms', { name: roomName });

    await advance(1);

    const fd = new FormData();
    fd.append('file', file);
    const req = api.post(`/api/rooms/${room.id}/upload-floorplan`, fd);

    await advance(2);
    await advance(3);
    await advance(4);

    const { data } = await req;

    await advance(5);

    const baseUrl = getApiBaseUrl();
    let imageUrl = data?.floor_plan_url || '';
    if (imageUrl.startsWith('/uploads/')) {
      imageUrl = baseUrl ? `${baseUrl}${imageUrl}` : imageUrl;
    }
    if (!imageUrl) {
      imageUrl = URL.createObjectURL(file);
    }

    const parseResult = buildParseResult(data, data?.parse_result || {});
    notifyParsePipeline(data, parseResult);
    await new Promise((r) => setTimeout(r, 400));
    onComplete?.(room, parseResult, imageUrl);
  };

  const runGuest = async () => {
    await advance(0);

    const fd = new FormData();
    fd.append('file', file);
    const req = api.post('/api/public/parse-floorplan', fd);

    await advance(1);
    await advance(2);
    await advance(3);
    await advance(4);

    const { data } = await req;

    await advance(5);

    const parseResult = buildParseResult(data, data?.parse_result || {});
    notifyParsePipeline(data, parseResult);

    // Guests don't have a server-side room; fabricate a minimal one the caller
    // can turn into a draft after the user edits the zones.
    const room = {
      id: 'guest-pending', // caller will replace with a real draft id
      name: roomName,
      unit: 'inches',
      width: data?.width || null,
      depth: data?.depth || null,
      scale_px_per_inch: parseResult.scale_px_per_inch || 1,
    };

    // Keep the image as a data URL so it survives refresh in the Studio.
    const imageUrl = URL.createObjectURL(file);

    await new Promise((r) => setTimeout(r, 400));
    onComplete?.(room, parseResult, imageUrl);
  };

  const run = async () => {
    try {
      if (isGuest) {
        await runGuest();
        return;
      }
      try {
        await runAuthed();
      } catch (authedErr) {
        const status = authedErr?.response?.status;
        if (status === 401 || status === 403) {
          toast.error('Session expired — analyzing as guest. Sign in again to save to your account.', {
            duration: 7000,
          });
          await runGuest();
          return;
        }
        throw authedErr;
      }
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
