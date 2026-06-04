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
import {
  getFloorplanImageMeta,
  resolveEditorZonesFromParse,
  roomDimensionsFromParse,
  zonesToBoundaryRelative,
} from '@/utils/floorplanGeometry';

export default function Upload({ embedInWizard = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isGuest = !user;
  const createDraftRoom = useLayoutStore((s) => s.createDraftRoom);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  // Post-analysis state for the room editor
  // { room, imageUrl, parseResult }
  const [editorData, setEditorData] = useState(null);
  const [spaceReview, setSpaceReview] = useState(null);
  const [savingSpaces, setSavingSpaces] = useState(false);

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

  const editorLayout = useMemo(() => {
    if (!editorData?.parseResult) return null;
    const parseResult = editorData.parseResult;
    const zones = resolveEditorZonesFromParse(parseResult);
    const { imageWidth, imageHeight, boundary } = getFloorplanImageMeta(parseResult, zones);
    return { zones, imageWidth, imageHeight, boundary };
  }, [editorData]);

  const onEditorConfirm = async (finalZones) => {
    if (!editorData?.room) return;

    const parseResult = editorData.parseResult || {};
    const imagePixelZones = finalZones;
    const { imageWidth, imageHeight, boundary } = getFloorplanImageMeta(parseResult, imagePixelZones);
    const dims = roomDimensionsFromParse(
      parseResult,
      imagePixelZones,
      parseResult.scale_px_per_inch || 1,
    );
    const scale = dims.scalePxPerInch;
    const roomWidth = dims.roomWidth;
    const roomDepth = dims.roomDepth;
    const boundaryForRoom = boundary || parseResult.boundary || null;
    const roomZones = boundaryForRoom
      ? zonesToBoundaryRelative(imagePixelZones, boundaryForRoom)
      : imagePixelZones;

    const spaces = imagePixelZones.map((zone) => ({
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
      imagePixelZones,
      roomZones,
      imageWidth,
      imageHeight,
      boundary: boundaryForRoom,
      roomWidth: Math.round(roomWidth),
      roomDepth: Math.round(roomDepth),
      scale,
      spaces,
      previewImageUrl,
    });
    setEditorData(null);
  };

  /** Persist confirmed spaces/floorplan onto project (vision collected separately on /vision). */
  const persistSpaceReviewToProject = async () => {
    if (!spaceReview) return null;
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

    let roomId = spaceReview.sourceRoomId;
    const payload = {
      zones: spaceReview.roomZones,
      width: spaceReview.roomWidth,
      depth: spaceReview.roomDepth,
      scale_px_per_inch: spaceReview.scale,
    };

    const displayProjectName = resolvedProjectTitle || projectName?.trim();

    if (isGuest) {
      const draft = createDraftRoom({
        name: displayProjectName || `${project.name} - Floorplan`,
        width: spaceReview.roomWidth,
        depth: spaceReview.roomDepth,
        scale_px_per_inch: spaceReview.scale,
        zones: spaceReview.roomZones,
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
    project.floorplan = {
      imageUrl: spaceReview.imageUrl || null,
      zones: spaceReview.imagePixelZones || [],
      imageWidth: spaceReview.imageWidth || null,
      imageHeight: spaceReview.imageHeight || null,
      boundary: spaceReview.boundary || null,
      coordinateSpace: 'imagePixels',
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
    return project;
  };

  const continueToProjectVision = async () => {
    if (!spaceReview || savingSpaces) return;
    setSavingSpaces(true);
    try {
      const project = await persistSpaceReviewToProject();
      if (!project?.id) {
        toast.error('Could not save spaces. Please try again.');
        return;
      }
      setSpaceReview(null);
      navigate(`/studio/project/${project.id}/vision?setup=new`);
    } catch {
      toast.error('Could not save spaces. Please try again.');
    } finally {
      setSavingSpaces(false);
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
                <li>03 Open Project Vision Assistant, then enter studio</li>
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
            imageWidth={editorLayout?.imageWidth || 800}
            imageHeight={editorLayout?.imageHeight || 600}
            initialZones={editorLayout?.zones || []}
            boundary={editorLayout?.boundary || null}
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
                <button className="btn-ink" onClick={continueToProjectVision} disabled={savingSpaces}>
                  {savingSpaces ? 'Saving spaces…' : 'Continue to Project Vision'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
