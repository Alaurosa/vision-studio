import { useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLayoutStore } from '@/store/layoutStore';
import AnalysisWorkflow from '@/components/upload/AnalysisWorkflow';
import RoomEditor from '@/components/upload/RoomEditor';
import { createProjectDraft, getProjectById, upsertProject } from '@/utils/projectCompat';

export default function Upload({ embedInWizard = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isGuest = !user;
  const createDraftRoom = useLayoutStore((s) => s.createDraftRoom);
  const setProjectTheme = useLayoutStore((s) => s.setProjectTheme);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  // Post-analysis state for the room editor
  // { room, imageUrl, parseResult }
  const [editorData, setEditorData] = useState(null);
  const [spaceReview, setSpaceReview] = useState(null);
  const [visionStep, setVisionStep] = useState(false);
  const [visionPrompt, setVisionPrompt] = useState('');
  const [visionStyle, setVisionStyle] = useState([]);
  const [inspirationImageName, setInspirationImageName] = useState('');

  const inputRef = useRef(null);
  const projectIdParam = searchParams.get('projectId');
  const wizardProject = projectIdParam ? getProjectById(projectIdParam) : null;
  const resolvedProjectTitle =
    wizardProject?.name || searchParams.get('projectName') || projectName?.trim() || 'Untitled project';

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

  const upsertSpace = (index, patch) => {
    setSpaceReview((prev) => {
      if (!prev) return prev;
      const next = [...prev.spaces];
      next[index] = { ...next[index], ...patch };
      return { ...prev, spaces: next };
    });
  };

  const addSpace = (type = 'interior') => {
    setSpaceReview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        spaces: [
          ...prev.spaces,
          {
            id: `space-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: type === 'interior' ? `Interior ${prev.spaces.length + 1}` : `Exterior ${prev.spaces.length + 1}`,
            type,
            zoneId: null,
            geometry: null,
          },
        ],
      };
    });
  };

  const removeSpace = (index) => {
    setSpaceReview((prev) => {
      if (!prev) return prev;
      return { ...prev, spaces: prev.spaces.filter((_, i) => i !== index) };
    });
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

      normalizedZones = finalZones.map((z) => {
        const relBbox = [z.bbox[0] - minX, z.bbox[1] - minY, z.bbox[2] - minX, z.bbox[3] - minY];
        const relPolygon = z.polygon.map(([x, y]) => [x - minX, y - minY]);
        const relGeometry = z.geometry
          ? {
              ...z.geometry,
              bbox: {
                x: Math.max(0, z.geometry.bbox.x - minX),
                y: Math.max(0, z.geometry.bbox.y - minY),
                width: z.geometry.bbox.width,
                height: z.geometry.bbox.height,
              },
              points: (z.geometry.points || []).map((pt) => ({
                x: pt.x - minX,
                y: pt.y - minY,
              })),
            }
          : null;
        return {
          ...z,
          bbox: relBbox,
          polygon: relPolygon,
          geometry: relGeometry,
        };
      });

      roomWidth = (maxX - minX) / scale;
      roomDepth = (maxY - minY) / scale;
    } else if (editorData.parseResult?.boundary) {
      roomWidth = editorData.parseResult.boundary.w / scale;
      roomDepth = editorData.parseResult.boundary.h / scale;
    }

    const spaces = normalizedZones.map((zone) => ({
      id: `space-${zone.id}`,
      name: zone.name,
      type: zone.type === 'exterior' ? 'exterior' : 'interior',
      zoneId: zone.id,
      geometry: zone.geometry || null,
    }));

    // Capture imageUrl + parseResult so the confirmation page can show the
    // floorplan preview and exact server-stored URL even after editorData clears.
    const previewImageUrl =
      editorData.parseResult?.floor_plan_url || editorData.imageUrl || null;

    setSpaceReview({
      sourceRoomId: editorData.room.id,
      imageUrl: previewImageUrl,
      normalizedZones,
      roomWidth: Math.round(roomWidth),
      roomDepth: Math.round(roomDepth),
      scale,
      spaces,
      previewImageUrl,
    });
    setEditorData(null);
  };

  const finalizeProject = async () => {
    if (!spaceReview) return;
    let project = projectIdParam ? getProjectById(projectIdParam) : null;
    const nameFromWizard =
      resolvedProjectTitle || searchParams.get('projectName') || projectName?.trim();
    if (!project) {
      project = createProjectDraft({
        name: nameFromWizard || 'Untitled Project',
        propertyType: searchParams.get('propertyType') || 'House',
        startMode: 'upload',
      });
    } else if (nameFromWizard && (!project.name || project.name === 'Untitled Project')) {
      project = { ...project, name: nameFromWizard };
    }

    const theme = {
      styleChips: visionStyle,
      prompt: visionPrompt,
      inspirationImageName,
      updatedAt: new Date().toISOString(),
    };
    setProjectTheme(theme);

    let roomId = spaceReview.sourceRoomId;
    const payload = {
      zones: spaceReview.normalizedZones,
      width: spaceReview.roomWidth,
      depth: spaceReview.roomDepth,
    };

    const displayProjectName = resolvedProjectTitle || projectName?.trim();

    if (isGuest) {
      const draft = createDraftRoom({
        name: displayProjectName || `${project.name} - Floorplan`,
        width: spaceReview.roomWidth,
        depth: spaceReview.roomDepth,
        scale_px_per_inch: spaceReview.scale,
        zones: spaceReview.normalizedZones,
      });
      roomId = draft.id;
    } else {
      try {
        await api.put(`/api/rooms/${spaceReview.sourceRoomId}`, payload);
      } catch (err) {
        console.error('Failed to save room updates:', err);
      }
    }

    const mergedSpaces = spaceReview.spaces.map((space) => ({
      ...space,
      roomId,
      placeholderMode: space.type === 'exterior',
      geometry: space.geometry || null,
    }));
    project.spaces = mergedSpaces;
    project.theme = theme;
    project.floorplan = {
      imageUrl: spaceReview.imageUrl || null,
      zones: spaceReview.normalizedZones || [],
      scalePxPerInch: spaceReview.scale || null,
      sourceRoomId: roomId || null,
      updatedAt: new Date().toISOString(),
    };
    project.previewImageUrl =
      spaceReview.previewImageUrl || spaceReview.imageUrl || project.previewImageUrl || null;
    project.detectedDimensions = {
      width: spaceReview.roomWidth,
      depth: spaceReview.roomDepth,
    };
    project.updatedAt = new Date().toISOString();
    upsertProject(project);

    navigate(`/studio/project/${project.id}/confirm?mode=adjust`);
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
      <section className={`mx-auto max-w-7xl px-6 md:px-8 ${embedInWizard ? 'pb-6 pt-10' : 'pb-10 pt-20'}`}>
        {embedInWizard && (
          <button
            type="button"
            onClick={() => navigate('/studio/new')}
            className="text-[11px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] mb-6"
          >
            ← Back to new project
          </button>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-vs-accent">Upload Floorplan</p>
        <h1 className={`${embedInWizard ? 'display-md' : 'display-lg'} max-w-4xl`}>
          {embedInWizard ? 'Add your floorplan to this project.' : 'Start with the space you already have.'}
        </h1>
        {!embedInWizard && (
          <p className="mt-8 max-w-3xl leading-relaxed text-[#2d2d2d]">
            Upload a floorplan, sketch, or room photo. Vision Studio reads the room structure,
            scale, and spatial zones so the design process begins with real geometry.
          </p>
        )}
        {isGuest && !embedInWizard && (
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
              {embedInWizard && resolvedProjectTitle ? (
                <div className="mb-6 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-1">Project</div>
                  <div className="font-display text-lg text-[#171717]">{resolvedProjectTitle}</div>
                </div>
              ) : (
                <label className="block mb-6">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-2 text-[#5b5b5b]">Project name</div>
                  <input
                    className="input-field bg-[#fffdf9]"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Untitled project"
                  />
                </label>
              )}

              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-2 text-[#5b5b5b]">What happens next</div>
              <ol className="text-sm text-[#2d2d2d] space-y-2 mb-8">
                <li>01 Upload plan or property photo</li>
                <li>02 Confirm detected spaces and scale</li>
                <li>03 Set project vision and enter studio</li>
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
              {!embedInWizard && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/studio')}
                    className="btn-ghost mt-3 w-full"
                  >
                    Use Sample Project
                  </button>
                  <p className="text-[11px] text-ink-400 mt-4 leading-relaxed">
                    No floorplan handy? Skip the upload and start from a blank template
                    in the Studio.
                  </p>
                </>
              )}
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
              roomName={projectName || 'Untitled project'}
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

      {/* Space confirmation step */}
      <AnimatePresence>
        {spaceReview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#f6f3ee]/95 backdrop-blur-sm grid place-items-center p-4">
            <div className="w-full max-w-3xl rounded-[22px] border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] p-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-3">Confirm Spaces</div>
              <h2 className="display-md mb-2">Review interior and exterior spaces</h2>
              <p className="text-sm text-[#5b5b5b] mb-6">Rename spaces, change type, remove false detections, or add missed spaces.</p>
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {spaceReview.spaces.map((space, idx) => (
                  <div key={space.id} className="grid grid-cols-12 gap-2 items-center border border-[rgba(0,0,0,0.08)] rounded-lg p-3 bg-[#fffdf9]">
                    <input className="col-span-6 input-field bg-transparent" value={space.name} onChange={(e) => upsertSpace(idx, { name: e.target.value })} />
                    <select className="col-span-4 input-field bg-transparent" value={space.type} onChange={(e) => upsertSpace(idx, { type: e.target.value })}>
                      <option value="interior">Interior</option>
                      <option value="exterior">Exterior</option>
                    </select>
                    <button className="col-span-2 text-[10px] uppercase tracking-editorial text-red-600" onClick={() => removeSpace(idx)}>Delete</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn-ghost" onClick={() => addSpace('interior')}>+ Interior</button>
                <button className="btn-ghost" onClick={() => addSpace('exterior')}>+ Exterior</button>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button className="btn-ghost" onClick={() => setSpaceReview(null)}>Cancel</button>
                <button className="btn-ink" onClick={() => { setSpaceReview((s) => ({ ...s })); setVisionStep(true); }}>Continue</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Whole-property vision onboarding */}
      <AnimatePresence>
        {spaceReview && visionStep && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#f6f3ee]/95 backdrop-blur-sm grid place-items-center p-4">
            <div className="w-full max-w-2xl rounded-[22px] border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] p-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-3">Vision Step</div>
              <h2 className="display-md mb-2">What feeling should guests have when entering?</h2>
              <p className="text-sm text-[#5b5b5b] mb-5">Set a whole-property theme before entering the studio.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {['Warm', 'Modern', 'Minimal', 'Coastal', 'Industrial', 'Organic'].map((chip) => {
                  const active = visionStyle.includes(chip);
                  return (
                    <button key={chip}
                      onClick={() => setVisionStyle((prev) => (prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]))}
                      className={`text-[10px] uppercase tracking-editorial rounded-full px-3 py-1.5 border ${active ? 'border-[#004aad]/45 text-[#004aad] bg-[#eef4f7]' : 'border-[rgba(0,0,0,0.08)] text-[#5b5b5b]'}`}>
                      {chip}
                    </button>
                  );
                })}
              </div>
              <textarea className="w-full min-h-[110px] rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] p-4 text-sm"
                value={visionPrompt}
                onChange={(e) => setVisionPrompt(e.target.value)}
                placeholder="Describe the whole-house mood, circulation feel, and design intent..." />
              <label className="mt-4 block text-sm text-[#5b5b5b]">
                Inspiration image (optional)
                <input type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={(e) => setInspirationImageName(e.target.files?.[0]?.name || '')} />
                {inspirationImageName && <span className="text-xs text-[#171717]">Selected: {inspirationImageName}</span>}
              </label>
              <div className="flex justify-end gap-3 mt-6">
                <button className="btn-ghost" onClick={() => setVisionStep(false)}>Back</button>
                <button className="btn-ink" onClick={finalizeProject}>Enter Studio</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
