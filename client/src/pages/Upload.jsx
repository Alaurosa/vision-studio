import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLayoutStore } from '@/store/layoutStore';
import AnalysisWorkflow from '@/components/upload/AnalysisWorkflow';
import RoomEditor from '@/components/upload/RoomEditor';

// Turn a File/Blob into a data URL so we can stash it in localStorage
// (so the floorplan survives a refresh while in draft mode).
async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Upload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuest = !user;
  const createDraftRoom = useLayoutStore((s) => s.createDraftRoom);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  // Post-analysis state for the room editor
  // { room, imageUrl, parseResult }
  const [editorData, setEditorData] = useState(null);

  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setError(null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  };

  const startAnalysis = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
  };

  /** Called by AnalysisWorkflow when AI analysis finishes */
  const onAnalysisComplete = (room, parseResult, imageUrl) => {
    setAnalyzing(false);
    // Open the room editor overlay instead of navigating directly
    setEditorData({ room, parseResult, imageUrl });
  };

  const onAnalysisError = (msg) => {
    setAnalyzing(false);
    const message = msg || 'Analysis failed. Please try again.';
    setError(message);
    toast.error(message);
  };

  const onEditorConfirm = async (finalZones) => {
    if (!editorData?.room) return;

    const scale = editorData.parseResult?.scale_px_per_inch || 1;
    let roomWidth = 240;
    let roomDepth = 180;
    let normalizedZones = finalZones;

    if (finalZones.length > 0) {
      const minX = Math.min(...finalZones.map(z => z.bbox[0]));
      const minY = Math.min(...finalZones.map(z => z.bbox[1]));
      const maxX = Math.max(...finalZones.map(z => z.bbox[2]));
      const maxY = Math.max(...finalZones.map(z => z.bbox[3]));

      normalizedZones = finalZones.map(z => ({
        ...z,
        bbox: [z.bbox[0] - minX, z.bbox[1] - minY, z.bbox[2] - minX, z.bbox[3] - minY],
        polygon: z.polygon.map(([x, y]) => [x - minX, y - minY]),
      }));

      roomWidth = (maxX - minX) / scale;
      roomDepth = (maxY - minY) / scale;
    } else if (editorData.parseResult?.boundary) {
      roomWidth = editorData.parseResult.boundary.w / scale;
      roomDepth = editorData.parseResult.boundary.h / scale;
    }

    // --- Guest path: build a draft room entirely client-side, then enter studio.
    if (isGuest) {
      try {
        const dataUrl = await fileToDataUrl(file);
        const draft = createDraftRoom({
          name: roomName || 'Untitled draft',
          width: Math.round(roomWidth),
          depth: Math.round(roomDepth),
          scale_px_per_inch: scale,
          zones: normalizedZones,
          floorPlanDataUrl: dataUrl,
        });
        navigate(`/studio/${draft.id}`);
      } catch (err) {
        console.error('Failed to create draft room:', err);
        setError('Could not build your draft room. Please try again.');
      }
      return;
    }

    // --- Authed path: the server already owns the room; just save zones.
    try {
      await api.put(`/api/rooms/${editorData.room.id}`, {
        zones: normalizedZones,
        width: Math.round(roomWidth),
        depth: Math.round(roomDepth),
      });
      navigate(`/studio/${editorData.room.id}`);
    } catch (err) {
      console.error('Failed to save rooms:', err);
      navigate(`/studio/${editorData.room.id}`);
    }
  };

  const onEditorCancel = () => {
    setEditorData(null);
  };

  return (
    <div className="relative">
      <Helmet>
        <title>Upload Floorplan — Vision Studio</title>
        <meta name="description" content="Upload a PNG, JPEG, or PDF floorplan. Our AI vision pipeline detects walls, segments rooms, and measures dimensions automatically." />
      </Helmet>
      <section className="max-w-8xl mx-auto px-6 md:px-10 pt-20 pb-10">
        <p className="eyebrow mb-6">Step 01 — Intake</p>
        <h1 className="display-lg max-w-4xl">
          Bring us a floorplan. <span className="italic">We'll read the room.</span>
        </h1>
        <p className="text-ink-600 max-w-2xl mt-8 leading-relaxed">
          Drop a PNG, JPEG, or PDF of any floorplan. Our vision pipeline detects
          walls, segments sub-rooms, and measures dimensions — so you can walk
          straight into the Studio with a real, to-scale canvas.
        </p>
        {isGuest && (
          <p className="text-ink-500 text-sm mt-4 max-w-2xl">
            You're designing as a guest — no sign-in needed. When you're happy
            with your layout, hit <span className="font-medium text-ink-900">Save to account</span> in
            the Studio to keep it forever.
          </p>
        )}
      </section>

      <section className="max-w-8xl mx-auto px-6 md:px-10 pb-24">
        <div className="grid md:grid-cols-12 gap-10">
          {/* Drop zone */}
          <div className="md:col-span-8">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`relative aspect-[4/3] border border-ink-900/15 bg-paper-100 cursor-pointer overflow-hidden group transition hover:border-ink-900/40
                ${previewUrl ? '' : 'flex items-center justify-center'}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
              />
              {previewUrl ? (
                <img src={previewUrl} alt="Floorplan preview" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center p-10">
                  <div className="eyebrow mb-4">Drag & Drop</div>
                  <div className="display-md mb-3">or click to browse</div>
                  <p className="text-ink-500 text-sm max-w-sm mx-auto">
                    PNG · JPEG · WEBP · PDF — up to 10MB.
                  </p>
                </div>
              )}
            </div>
            {previewUrl && (
              <button
                onClick={() => { setFile(null); setPreviewUrl(null); }}
                className="mt-4 text-[11px] uppercase tracking-editorial text-ink-500 hover:text-ink-900"
              >
                ← Choose a different file
              </button>
            )}
          </div>

          {/* Details + action */}
          <div className="md:col-span-4">
            <div className="sticky top-24 panel p-8">
              <div className="eyebrow mb-6">Project Details</div>
              <label className="block mb-6">
                <div className="eyebrow mb-2 text-ink-600">Room name</div>
                <input
                  className="input-field"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Untitled room"
                />
              </label>

              <div className="eyebrow mb-2 text-ink-600">What happens next</div>
              <ol className="text-sm text-ink-700 space-y-2 mb-8">
                <li>01 — Image intake & preprocessing</li>
                <li>02 — AI room segmentation</li>
                <li>03 — You adjust the detected rooms</li>
                <li>04 — Hand-off to the Studio</li>
              </ol>

              {error && (
                <div className="text-sienna-600 text-sm mb-4 border border-sienna-500/30 bg-sienna-300/10 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <button
                disabled={!file || analyzing}
                onClick={startAnalysis}
                className="btn-ink w-full"
              >
                {analyzing ? 'Analyzing…' : 'Analyze Floorplan'}
              </button>
              <p className="text-[11px] text-ink-400 mt-4 leading-relaxed">
                No floorplan handy? Skip the upload and start from a blank template
                in the Studio.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Analysis pipeline overlay */}
      <AnimatePresence>
        {analyzing && file && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-paper-50/95 backdrop-blur-sm grid place-items-center"
          >
            <AnalysisWorkflow
              file={file}
              roomName={roomName || 'Untitled room'}
              isGuest={isGuest}
              onComplete={onAnalysisComplete}
              onError={onAnalysisError}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room editor overlay (after analysis) */}
      <AnimatePresence>
        {editorData && (
          <RoomEditor
            imageUrl={editorData.imageUrl}
            imageWidth={editorData.parseResult?.image_width || 800}
            imageHeight={editorData.parseResult?.image_height || 600}
            initialZones={editorData.parseResult?.rooms || []}
            boundary={editorData.parseResult?.boundary || null}
            scalePxPerInch={editorData.parseResult?.scale_px_per_inch || 1}
            onConfirm={onEditorConfirm}
            onCancel={onEditorCancel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
