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
        const draft = createDraftRoom({
          name: roomName || 'Untitled draft',
          width: Math.round(roomWidth),
          depth: Math.round(roomDepth),
          scale_px_per_inch: scale,
          zones: normalizedZones,
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
    <div className="relative bg-[#f6f3ee] text-[#171717]">
      <Helmet>
        <title>Upload Floorplan — Vision Studio</title>
        <meta name="description" content="Upload a PNG, JPEG, or PDF floorplan. Our AI vision pipeline detects walls, segments rooms, and measures dimensions automatically." />
      </Helmet>
      <section className="mx-auto max-w-7xl px-6 pb-10 pt-20 md:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-vs-accent">Upload Floorplan</p>
        <h1 className="display-lg max-w-4xl">
          Start with the space you already have.
        </h1>
        <p className="mt-8 max-w-3xl leading-relaxed text-[#2d2d2d]">
          Upload a floorplan, sketch, or room photo. Vision Studio reads the room structure,
          scale, and spatial zones so the design process begins with real geometry.
        </p>
        {isGuest && (
          <p className="text-ink-500 text-sm mt-4 max-w-2xl">
            You're designing as a guest — no sign-in needed. When you're happy
            with your layout, hit <span className="font-medium text-ink-900">Save to account</span> in
            the Studio to keep it forever.
          </p>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 md:px-8">
        <div className="grid md:grid-cols-12 gap-10">
          {/* Drop zone */}
          <div className="md:col-span-8">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`relative aspect-[4/3] rounded-[22px] border border-[rgba(0,0,0,0.08)] bg-[#eef4f7] cursor-pointer overflow-hidden group transition hover:border-[#004aad]/45
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
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-4">Architectural Intake</div>
                  <div className="display-md mb-3 text-[#171717]">Drop plan or click to browse</div>
                  <p className="text-[#5b5b5b] text-sm max-w-sm mx-auto">
                    PNG · JPEG · WEBP · PDF — up to 10MB.
                  </p>
                </div>
              )}
            </div>
            {previewUrl && (
              <button
                onClick={() => { setFile(null); setPreviewUrl(null); }}
                className="mt-4 text-[11px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717]"
              >
                ← Choose a different file
              </button>
            )}
          </div>

          {/* Details + action */}
          <div className="md:col-span-4">
            <div className="sticky top-24 rounded-[22px] border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] p-8 shadow-[0_18px_40px_rgba(4,12,46,0.06)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-6">Project Details</div>
              <label className="block mb-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-2 text-[#5b5b5b]">Room name</div>
                <input
                  className="input-field bg-[#fffdf9]"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Untitled room"
                />
              </label>

              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-2 text-[#5b5b5b]">What happens next</div>
              <ol className="text-sm text-[#2d2d2d] space-y-2 mb-8">
                <li>01 Upload plan or room photo</li>
                <li>02 Confirm detected rooms and scale</li>
                <li>03 Continue into studio layout</li>
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
                {analyzing ? 'Uploading…' : 'Upload Floorplan'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/studio')}
                className="btn-ghost mt-3 w-full"
              >
                Use Sample Room
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
            className="fixed inset-0 z-50 bg-[#f6f3ee]/95 backdrop-blur-sm grid place-items-center"
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
