import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLayoutStore } from '@/store/layoutStore';
import { useAuth } from '@/hooks/useAuth';
import { inchesToFeet } from '@/utils/scale';
import api from '@/lib/api';
import LoginModal from '@/components/auth/LoginModal';
import KeyboardShortcutsPopover from '@/components/studio/KeyboardShortcutsPopover';

const isDraftId = (id) => typeof id === 'string' && id.startsWith('draft-');

export default function StudioToolbar({
  onToggleCatalog,
  catalogOpen,
  projectIdForBack,
  contextLabel,
  projectTitle,
  projectMode = false,
}) {
  const {
    room, viewMode, setViewMode, gridEnabled, toggleGrid,
    isChatOpen, toggleChat, undo, redo, validate,
    selectedId, furniture, rotateFurniture, removeFurniture,
    saveProject,
  } = useLayoutStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsAnchorRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const selectedItem = furniture.find((item) => item.id === selectedId);

  const draft = isDraftId(room?.id);

  const doValidate = () => {
    const { valid, errors } = validate();
    if (valid) {
      toast.success('Layout looks clean — no overlaps or overflow.');
    } else {
      toast.error(errors.slice(0, 3).join(' · '));
    }
  };

  const autoPlace = async () => {
    if (!room?.id || furniture.length === 0) return;
    const toastId = toast.loading('Auto-arranging furniture…');
    try {
      if (draft) {
        // Draft rooms: send room context + placements to the server
        const { data } = await api.post('/api/layout/auto-place', {
          room_id: room.id,
          room_context: {
            id: room.id, name: room.name, width: room.width, depth: room.depth,
            height: room.height || 96, unit: room.unit || 'inches',
          },
          placements_context: furniture.map(f => ({
            id: f.id, name: f.name, category: f.category, width: f.width,
            depth: f.depth, height: f.height, x_inches: f.x_inches,
            y_inches: f.y_inches, rotation: f.rotation,
          })),
        });
        // Apply the returned positions to local state
        const updates = data.placements || [];
        for (const u of updates) {
          const existing = furniture.find(f => f.id === u.id || f.name === u.name);
          if (existing) {
            useLayoutStore.getState().updateFurniture(existing.id, {
              x_inches: u.x_inches, y_inches: u.y_inches, rotation: u.rotation,
            });
          }
        }
        toast.success('Auto-arranged successfully', { id: toastId });
      } else {
        await api.post('/api/layout/auto-place', { room_id: room.id });
        const { data } = await api.get(`/api/rooms/${room.id}`);
        useLayoutStore.setState({ furniture: data.placements || [] });
        toast.success('Auto-arranged successfully', { id: toastId });
      }
    } catch (e) {
      toast.error('Auto-arrange failed', { id: toastId });
    }
  };

  // Called either directly (if already signed in) or after the login modal finishes.
  const runSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const serverRoom = await saveProject();
      setSaveMsg('Saved ✓');
      toast.success(draft ? 'Room saved to your account!' : 'Project saved');
      setTimeout(() => setSaveMsg(null), 3000);
      // Draft just became a real room — swap to its server id.
      if (draft && serverRoom?.id) navigate(`/studio/${serverRoom.id}`, { replace: true });
    } catch (e) {
      console.error('save project', e);
      const msg = e?.response?.data?.error || e.message || 'Save failed';
      setSaveMsg(msg);
      toast.error(msg);
      setTimeout(() => setSaveMsg(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const onSaveClick = async () => {
    if (draft && !user) {
      setShowLogin(true);
      return;
    }
    await runSave();
  };

  const saveLabel = saving
    ? 'Saving…'
    : draft
      ? (user ? 'Save Project' : 'Sign in & Save')
      : 'Save Project';

  const backTarget = projectIdForBack ? `/studio/project/${projectIdForBack}` : '/studio';
  const backLabel = projectIdForBack ? '← Project' : '← Studio';

  return (
    <div className="h-14 border-b border-ink-900/10 bg-paper-50 flex items-center px-4 md:px-6 gap-2 md:gap-4 overflow-x-auto">
      <Link to={backTarget} className="eyebrow text-ink-500 hover:text-ink-900 shrink-0">{backLabel}</Link>
      <div className="h-5 w-px bg-ink-900/15 shrink-0" />
      <div className="font-display text-lg truncate max-w-xs flex items-center gap-2">
        {contextLabel || room?.name || 'Untitled'}
        {draft && (
          <span className="text-[9px] uppercase tracking-editorial px-2 py-0.5 rounded-full bg-sienna-500/10 text-sienna-700 border border-sienna-500/30 shrink-0">
            Draft
          </span>
        )}
      </div>
      <div className="text-xs text-ink-500 shrink-0">
        {projectMode
          ? (projectTitle || 'Untitled project')
          : room?.width
            ? `${inchesToFeet(room.width)} × ${inchesToFeet(room.depth)}`
            : ''}
      </div>

      <div className="flex-1 min-w-4" />

      {(saveMsg) && (
        <span className="text-[11px] uppercase tracking-editorial text-sienna-600 shrink-0 hidden lg:inline">
          {saveMsg}
        </span>
      )}

      {/* Save Project — always available so users can flush pending edits and confirm progress */}
      {room && (
        <button
          onClick={onSaveClick}
          disabled={saving}
          className="shrink-0 text-[10px] uppercase tracking-editorial px-4 py-1.5 rounded-full border bg-ink-900 text-paper-50 border-ink-900 hover:bg-ink-800 transition disabled:opacity-50"
        >
          {saveLabel}
        </button>
      )}

      {/* Catalog toggle (visible on mobile) */}
      <ToolbarBtn onClick={onToggleCatalog} active={catalogOpen} className="md:hidden">Workspace</ToolbarBtn>

      <ToolbarBtn onClick={undo}>Undo</ToolbarBtn>
      <ToolbarBtn onClick={redo}>Redo</ToolbarBtn>
      <ToolbarBtn onClick={toggleGrid} active={gridEnabled}>Grid</ToolbarBtn>
      <ToolbarBtn onClick={doValidate} className="hidden sm:inline-flex">Validate</ToolbarBtn>
      <ToolbarBtn onClick={autoPlace} className="hidden sm:inline-flex">Auto-Arrange</ToolbarBtn>
      {selectedId && (
        <>
          <div className="h-5 w-px bg-ink-900/15 shrink-0" />
          <ToolbarBtn onClick={() => rotateFurniture(selectedId, (selectedItem?.rotation || 0) - 15)}>Rotate -</ToolbarBtn>
          <ToolbarBtn onClick={() => rotateFurniture(selectedId, (selectedItem?.rotation || 0) + 15)}>Rotate +</ToolbarBtn>
          <ToolbarBtn onClick={() => removeFurniture(selectedId)}>Delete</ToolbarBtn>
        </>
      )}
      <div className="h-5 w-px bg-ink-900/15 shrink-0" />
      <ToolbarBtn onClick={() => setViewMode('2d')} active={viewMode === '2d'}>2D</ToolbarBtn>
      <ToolbarBtn onClick={() => setViewMode('3d')} active={viewMode === '3d'}>3D</ToolbarBtn>
      <div className="h-5 w-px bg-ink-900/15 shrink-0" />
      <ToolbarBtn onClick={toggleChat} active={isChatOpen} className="hidden md:inline-flex">Space Assistant</ToolbarBtn>

      <div className="relative shrink-0">
        <span ref={shortcutsAnchorRef} className="inline-flex">
          <ToolbarBtn onClick={() => setShowShortcuts((s) => !s)} className="hidden md:inline-flex">?</ToolbarBtn>
        </span>
        <KeyboardShortcutsPopover
          open={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          anchorRef={shortcutsAnchorRef}
        />
      </div>

      {showLogin && (
        <LoginModal
          title="Sign in to save your draft"
          message="We'll attach this room, its zones, and all furniture to your account."
          onClose={() => setShowLogin(false)}
          onAuthed={async () => {
            setShowLogin(false);
            await runSave();
          }}
        />
      )}
    </div>
  );
}

function ToolbarBtn({ active, children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`shrink-0 text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border transition
        ${active
          ? 'bg-ink-900 text-paper-50 border-ink-900'
          : 'border-ink-900/20 text-ink-700 hover:border-ink-900 hover:text-ink-900'}
        disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
