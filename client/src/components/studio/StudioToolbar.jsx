import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLayoutStore } from '@/store/layoutStore';
import { useAuth } from '@/hooks/useAuth';
import { inchesToFeet } from '@/utils/scale';
import api from '@/lib/api';
import LoginModal from '@/components/auth/LoginModal';

const isDraftId = (id) => typeof id === 'string' && id.startsWith('draft-');

export default function StudioToolbar({ onToggleCatalog, catalogOpen }) {
  const {
    room, viewMode, setViewMode, gridEnabled, toggleGrid,
    isChatOpen, toggleChat, undo, redo, validate,
    selectedId, furniture, rotateFurniture, removeFurniture,
    saveDraftToAccount,
  } = useLayoutStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const selectedItem = furniture.find((item) => item.id === selectedId);

  const draft = isDraftId(room?.id);

  const runExport = async (format) => {
    if (!room?.id) return;
    if (draft) {
      toast.error('Save to your account before exporting.');
      return;
    }
    setExporting(true);
    try {
      const res = await api.post(`/api/export/${format}/${room.id}`, {}, { responseType: 'blob' });
      const blob = res.data;
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

  const doValidate = () => {
    const { valid, errors } = validate();
    if (valid) {
      toast.success('Layout looks clean — no overlaps or overflow.');
    } else {
      toast.error(errors.slice(0, 3).join(' · '));
    }
  };

  const autoPlace = async () => {
    if (!room?.id) return;
    if (draft) {
      toast.error('Auto-arrange requires a saved room. Save first.');
      return;
    }
    const toastId = toast.loading('Auto-arranging furniture…');
    try {
      await api.post('/api/layout/auto-place', { room_id: room.id });
      const { data } = await api.get(`/api/rooms/${room.id}`);
      useLayoutStore.setState({ furniture: data.placements || [] });
      toast.success('Auto-arranged successfully', { id: toastId });
    } catch (e) {
      toast.error('Auto-arrange failed', { id: toastId });
    }
  };

  // Called either directly (if already signed in) or after the login modal finishes.
  const pushDraftToServer = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const serverRoom = await saveDraftToAccount();
      setSaveMsg('Saved ✓');
      toast.success('Room saved to your account!');
      setTimeout(() => setSaveMsg(null), 3000);
      // Switch the URL to the now-real room id.
      if (serverRoom?.id) navigate(`/studio/${serverRoom.id}`, { replace: true });
    } catch (e) {
      console.error('save draft', e);
      const msg = e?.response?.data?.error || e.message || 'Save failed';
      setSaveMsg(msg);
      toast.error(msg);
      setTimeout(() => setSaveMsg(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const onSaveClick = async () => {
    if (!user) {
      setShowLogin(true);
      return;
    }
    await pushDraftToServer();
  };

  return (
    <div className="h-14 border-b border-ink-900/10 bg-paper-50 flex items-center px-4 md:px-6 gap-2 md:gap-4 overflow-x-auto">
      <Link to="/studio" className="eyebrow text-ink-500 hover:text-ink-900 shrink-0">← Rooms</Link>
      <div className="h-5 w-px bg-ink-900/15 shrink-0" />
      <div className="font-display text-lg truncate max-w-xs flex items-center gap-2">
        {room?.name || 'Untitled'}
        {draft && (
          <span className="text-[9px] uppercase tracking-editorial px-2 py-0.5 rounded-full bg-sienna-500/10 text-sienna-700 border border-sienna-500/30 shrink-0">
            Draft
          </span>
        )}
      </div>
      <div className="text-xs text-ink-500 shrink-0">
        {room?.width ? `${inchesToFeet(room.width)} × ${inchesToFeet(room.depth)}` : ''}
      </div>

      <div className="flex-1 min-w-4" />

      {(saveMsg) && (
        <span className="text-[11px] uppercase tracking-editorial text-sienna-600 shrink-0 hidden lg:inline">
          {saveMsg}
        </span>
      )}

      {/* Save-to-account — only shown while editing a draft */}
      {draft && (
        <button
          onClick={onSaveClick}
          disabled={saving}
          className="shrink-0 text-[10px] uppercase tracking-editorial px-4 py-1.5 rounded-full border bg-ink-900 text-paper-50 border-ink-900 hover:bg-ink-800 transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : user ? 'Save to account' : 'Sign in & save'}
        </button>
      )}

      {/* Catalog toggle (visible on mobile) */}
      <ToolbarBtn onClick={onToggleCatalog} active={catalogOpen} className="md:hidden">Catalog</ToolbarBtn>

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
      <div className="h-5 w-px bg-ink-900/15 shrink-0 hidden sm:block" />
      <ToolbarBtn onClick={() => runExport('json')} disabled={exporting || draft} className="hidden sm:inline-flex">JSON</ToolbarBtn>
      <ToolbarBtn onClick={() => runExport('svg')} disabled={exporting || draft} className="hidden sm:inline-flex">SVG</ToolbarBtn>
      <ToolbarBtn onClick={() => runExport('dxf')} disabled={exporting || draft} className="hidden sm:inline-flex">DXF</ToolbarBtn>
      <div className="h-5 w-px bg-ink-900/15 shrink-0" />
      <ToolbarBtn onClick={toggleChat} active={isChatOpen} className="hidden md:inline-flex">Chat</ToolbarBtn>

      {/* Keyboard shortcuts */}
      <div className="relative shrink-0">
        <ToolbarBtn onClick={() => setShowShortcuts(!showShortcuts)} className="hidden md:inline-flex">?</ToolbarBtn>
        {showShortcuts && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-ink-900/10 shadow-lg rounded-lg p-4 z-50">
            <div className="eyebrow mb-3">Keyboard Shortcuts</div>
            <ul className="text-xs text-ink-700 space-y-2">
              <li className="flex justify-between"><span>Undo</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">⌘Z</kbd></li>
              <li className="flex justify-between"><span>Redo</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">⌘⇧Z</kbd></li>
              <li className="flex justify-between"><span>Rotate selected</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">R</kbd></li>
              <li className="flex justify-between"><span>Delete selected</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">Del</kbd></li>
              <li className="flex justify-between"><span>Deselect</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">Esc</kbd></li>
              <li className="flex justify-between"><span>Zoom</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">Scroll</kbd></li>
              <li className="flex justify-between"><span>Pan canvas</span> <kbd className="text-ink-500 bg-paper-100 px-1.5 py-0.5 rounded text-[10px]">Drag bg</kbd></li>
            </ul>
          </div>
        )}
      </div>

      {showLogin && (
        <LoginModal
          title="Sign in to save your draft"
          message="We'll attach this room, its zones, and all furniture to your account."
          onClose={() => setShowLogin(false)}
          onAuthed={async () => {
            setShowLogin(false);
            await pushDraftToServer();
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
