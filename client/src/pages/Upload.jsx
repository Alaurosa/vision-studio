import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import AnalysisWorkflow from '@/components/upload/AnalysisWorkflow';

export default function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
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

  const onComplete = (room) => {
    setAnalyzing(false);
    if (room?.id) navigate(`/studio/${room.id}`);
  };

  const onError = (msg) => {
    setAnalyzing(false);
    setError(msg || 'Analysis failed. Please try again.');
  };

  return (
    <div className="relative">
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
                <li>01 — Image intake</li>
                <li>02 — Wall + opening detection</li>
                <li>03 — Sub-room segmentation</li>
                <li>04 — Scale calibration</li>
                <li>05 — Hand-off to the Studio</li>
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

      <AnimatePresence>
        {analyzing && file && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-paper-50/95 backdrop-blur-sm grid place-items-center"
          >
            <AnalysisWorkflow
              file={file}
              roomName={roomName || 'Untitled room'}
              onComplete={onComplete}
              onError={onError}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
