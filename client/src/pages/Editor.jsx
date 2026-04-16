import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayoutStore } from '../store/layoutStore';
import { useAuth } from '../hooks/useAuth';
import RoomCanvas from '../components/canvas/RoomCanvas';
import RoomViewer3D from '../components/viewer/RoomViewer3D';
import CatalogPanel from '../components/catalog/CatalogPanel';
import ChatPanel from '../components/chatbot/ChatPanel';
import FloorPlanUpload from '../components/upload/FloorPlanUpload';
import RoomPhotoUpload from '../components/upload/RoomPhotoUpload';
import AnalysisWorkflow from '../components/upload/AnalysisWorkflow';
import ZoneSelectorBar from '../components/editor/ZoneSelectorBar';
import ZoneConfirmModal from '../components/editor/ZoneConfirmModal';
import { getAABB, overlaps } from '../utils/collision';
import api from '../lib/api';
import { toast } from '../components/ui/Toast';

export default function Editor() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const {
    room, loading, furniture, selectedId, loadRoom,
    viewMode, setViewMode, gridEnabled, toggleGrid,
    isChatOpen, toggleChat, removeFurniture, updateFurniture,
    clearSelection, selectFurniture, updateRoom,
  } = useLayoutStore();
  const [showUpload, setShowUpload] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [showDimensions, setShowDimensions] = useState(false);
  const [dims, setDims] = useState({ width: '', depth: '' });
  const [autoPlacing, setAutoPlacing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [analysisWorkflow, setAnalysisWorkflow] = useState(null); // { file, data } when analyzing
  const [zoneConfirm, setZoneConfirm] = useState(null); // { detectedRooms, imageScale } when modal open
  const [validationErrors, setValidationErrors] = useState([]); // array of error strings from server validation
  const [validating, setValidating] = useState(false);
  const [showClearance, setShowClearance] = useState(false);

  const selectedItem = furniture.find(f => f.id === selectedId);
  const [roomError, setRoomError] = useState(false);

  useEffect(() => {
    if (roomId) {
      loadRoom(roomId).catch(() => setRoomError(true));
    }
  }, [roomId]);

  useEffect(() => {
    if (room) {
      setRoomName(room.name || 'Untitled Room');
      setDims({ width: room.width || '', depth: room.depth || '' });
      // Auto-open upload panel when room has no floor plan and no dimensions
      if (!room.floor_plan_url && !room.room_photo_url && !room.width && !room.depth) {
        setShowUpload(true);
      }
    }
  }, [room?.id, room?.name, room?.width, room?.depth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      const state = useLayoutStore.getState();
      const currentSelectedId = state.selectedId;
      const currentFurniture = state.furniture;
      const currentSelectedItem = currentFurniture.find(f => f.id === currentSelectedId);

      if ((e.key === 'Delete' || e.key === 'Backspace') && currentSelectedId) {
        e.preventDefault();
        state.removeFurniture(currentSelectedId);
      }
      if (e.key === 'Escape') {
        state.clearSelection();
        setShowUpload(false);
      }
      if (e.key === 'r' && currentSelectedId && currentSelectedItem) {
        e.preventDefault();
        const newRot = ((currentSelectedItem.rotation || 0) + 90) % 360;
        const candidate = { ...currentSelectedItem, rotation: newRot };
        const myBox = getAABB(candidate);
        const blocked = currentFurniture.some(other => {
          if (other.id === currentSelectedItem.id) return false;
          return overlaps(myBox, getAABB(other));
        });
        if (!blocked) {
          state.updateFurniture(currentSelectedId, { rotation: newRot });
        }
      }
      if (e.key === 'g') {
        e.preventDefault();
        state.toggleGrid();
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        state.undo();
      }
      if ((e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === 'y' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        state.redo();
      }
      if (e.key === '?') {
        setShowShortcuts(s => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const saveName = async () => {
    setEditingName(false);
    if (roomName !== room?.name) {
      await updateRoom({ name: roomName });
    }
  };

  const saveDimensions = async () => {
    setShowDimensions(false);
    const w = Math.max(12, Math.min(2400, Number(dims.width) || 0));
    const d = Math.max(12, Math.min(2400, Number(dims.depth) || 0));
    if (w > 0 && d > 0 && (w !== room?.width || d !== room?.depth)) {
      await updateRoom({ width: w, depth: d });
    }
  };

  const [autoPlaceError, setAutoPlaceError] = useState('');

  const handleValidate = async () => {
    if (!room || validating) return;
    setValidating(true);
    try {
      const { data } = await api.post('/api/layout/validate', { room_id: room.id });
      setValidationErrors(data.errors || []);
      if (data.valid) {
        setAutoPlaceError('');
        toast.success('Layout looks good — no issues found.');
        setTimeout(() => setValidationErrors([]), 5000);
      } else {
        toast.error(`${data.errors.length} issue${data.errors.length !== 1 ? 's' : ''} found. See panel below.`);
      }
    } catch (err) {
      console.error('Validation failed:', err);
      toast.error('Could not validate layout. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  const handleAutoPlace = async () => {
    if (!room || furniture.length === 0 || autoPlacing) return;
    setAutoPlacing(true);
    setAutoPlaceError('');
    try {
      const { data } = await api.post('/api/layout/auto-place', { room_id: room.id });
      if (data.placements?.length > 0) {
        await loadRoom(roomId);
        toast.success(`Auto-arranged ${data.placements.length} item${data.placements.length !== 1 ? 's' : ''}.`);
      } else {
        toast.info('Nothing to arrange.');
      }
    } catch (err) {
      console.error('Auto-place failed:', err);
      setAutoPlaceError('Auto-place failed. Try using the chat to arrange furniture.');
      toast.error('Auto-place failed. Try the chat assistant instead.');
      setTimeout(() => setAutoPlaceError(''), 5000);
    } finally {
      setAutoPlacing(false);
    }
  };

  if (roomError || (!loading && !room)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Room not found</p>
          <p className="text-sm text-slate-500 mb-4">This room may have been deleted or doesn't exist.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700 transition"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-3 py-2 bg-slate-900/70 border-b border-white/10 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition shrink-0"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-px h-6 bg-slate-700 shrink-0" />
          {editingName ? (
            <input
              type="text"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              className="text-sm font-semibold text-white border border-brand-500/50 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 w-40"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-semibold text-white hover:text-brand-500 transition truncate max-w-[160px]"
              title="Click to rename"
            >
              {room?.name || 'Untitled Room'}
            </button>
          )}
          {room?.width && room?.depth && (
            <button
              onClick={() => setShowDimensions(true)}
              className="text-xs text-slate-500 hover:text-slate-300 transition bg-slate-950 px-2 py-0.5 rounded-md shrink-0"
              title="Click to edit dimensions"
            >
              {room.width}" × {room.depth}"
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Upload button */}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              showUpload ? 'border-brand-500/50 bg-brand-500/10 text-brand-400' : 'border-white/10 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload
          </button>

          <div className="w-px h-6 bg-slate-700 mx-0.5" />

          {/* Auto-Place magic button */}
          <button
            onClick={handleAutoPlace}
            disabled={autoPlacing || furniture.length === 0}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              autoPlacing
                ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 cursor-wait'
                : furniture.length === 0
                ? 'border-white/10 text-slate-600 cursor-not-allowed'
                : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 bg-slate-900/70'
            }`}
            title="Use AI to find the best placement for all furniture"
          >
            {autoPlacing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-purple-500/30 border-t-purple-600 rounded-full animate-spin" />
                Arranging...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                Auto-Place
              </>
            )}
          </button>

          {/* Validate button */}
          <button
            onClick={handleValidate}
            disabled={validating || furniture.length === 0}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              validationErrors.length > 0
                ? 'border-red-500/20 bg-red-500/10 text-red-400'
                : validating
                ? 'border-white/10 text-slate-500 cursor-wait'
                : furniture.length === 0
                ? 'border-white/10 text-slate-600 cursor-not-allowed'
                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 bg-slate-900/70'
            }`}
            title="Validate layout for overlaps and bounds"
          >
            {validating ? (
              <span className="w-3.5 h-3.5 border-2 border-white/10 border-t-emerald-600 rounded-full animate-spin" />
            ) : validationErrors.length > 0 ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {validationErrors.length} issue{validationErrors.length !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Validate
              </>
            )}
          </button>

          <div className="w-px h-6 bg-slate-700 mx-0.5" />

          {/* View toggle */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden bg-slate-950">
            <button
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1.5 text-xs font-medium transition flex items-center gap-1 ${
                viewMode === '2d' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              2D
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 text-xs font-medium transition flex items-center gap-1 ${
                viewMode === '3d' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
              3D
            </button>
          </div>

          {/* Grid toggle */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => useLayoutStore.getState().undo()}
              disabled={useLayoutStore.getState().undoStack.length === 0}
              className="p-1.5 rounded-lg border border-white/10 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (⌘Z)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              onClick={() => useLayoutStore.getState().redo()}
              disabled={useLayoutStore.getState().redoStack.length === 0}
              className="p-1.5 rounded-lg border border-white/10 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (⌘⇧Z)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
          </div>

          <button
            onClick={toggleGrid}
            className={`p-1.5 rounded-lg border transition ${
              gridEnabled
                ? 'border-brand-500/50 text-brand-500 bg-brand-500/10'
                : 'border-white/10 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
            title="Toggle grid (G)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c0 .621-.504 1.125-1.125 1.125M21.375 12H12m9.375 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M12 13.125v1.5m0-1.5c0-.621.504-1.125 1.125-1.125M12 13.125c0-.621-.504-1.125-1.125-1.125m1.125 2.625c-.621 0-1.125.504-1.125 1.125M12 14.625c.621 0 1.125.504 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5m0-1.5c0 .621.504 1.125 1.125 1.125m-2.25 0h7.5" />
            </svg>
          </button>

          <button
            onClick={() => setShowClearance(c => !c)}
            className={`p-1.5 rounded-lg border transition ${
              showClearance
                ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                : 'border-white/10 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
            title="Toggle clearance zones (24&quot;)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </button>

          {/* Chat toggle */}
          <button
            onClick={toggleChat}
            className={`p-1.5 rounded-lg border transition ${
              isChatOpen
                ? 'border-brand-500/50 text-brand-500 bg-brand-500/10'
                : 'border-white/10 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
            title="Toggle AI chat"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </button>

          <div className="w-px h-6 bg-slate-700 mx-0.5" />

          {/* Help / Shortcuts */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="p-1.5 rounded-lg border border-white/10 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition"
            title="Keyboard shortcuts (?)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </button>

          {/* Export */}
          <ExportMenu roomId={roomId} />
        </div>
      </header>

      {/* Dimensions editor dialog */}
      {showDimensions && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDimensions(false)} onKeyDown={e => e.key === 'Escape' && setShowDimensions(false)}>
          <div className="bg-slate-900/70 rounded-3xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Room Dimensions</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Width (inches)</label>
                <input type="number" min="12" max="2400" value={dims.width} onChange={e => setDims(d => ({ ...d, width: e.target.value }))}
                  className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <p className="text-xs text-slate-500 mt-0.5">{(Number(dims.width) / 12).toFixed(1)} ft</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Depth (inches)</label>
                <input type="number" min="12" max="2400" value={dims.depth} onChange={e => setDims(d => ({ ...d, depth: e.target.value }))}
                  className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <p className="text-xs text-slate-500 mt-0.5">{(Number(dims.depth) / 12).toFixed(1)} ft</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowDimensions(false)} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition">Cancel</button>
              <button onClick={saveDimensions} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)} onKeyDown={e => e.key === 'Escape' && setShowShortcuts(false)}>
          <div className="bg-slate-900/70 rounded-3xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-500 hover:text-slate-300 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-1">
              {[
                ['R', 'Rotate selected item 90°'],
                ['Del / Backspace', 'Delete selected item'],
                ['Escape', 'Deselect / close panels'],
                ['G', 'Toggle snap grid'],
                ['⌘Z', 'Undo'],
                ['⌘⇧Z', 'Redo'],
                ['?', 'Show this help'],
                ['Scroll wheel', 'Zoom in/out on canvas'],
                ['Drag canvas', 'Pan the canvas view'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-slate-300">{desc}</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-800 border border-white/10 rounded text-slate-300">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Upload panel (conditional) */}
      {showUpload && !analysisWorkflow && (
        <div className="bg-slate-900/70 border-b border-white/10 px-4 py-3 flex gap-3 shrink-0">
          <FloorPlanUpload roomId={roomId} onAnalysisStart={(file) => {
            setAnalysisWorkflow({ file });
          }} onComplete={(data) => {
            const rooms = data?.parse_result?.rooms || [];
            if (rooms.length > 0) {
              const roomDetections = rooms.map(r => ({
                label: r.label,
                score: r.confidence || 0.8,
                bbox: r.bbox || [0, 0, 1, 1],
                polygon: r.polygon,
                type: 'room',
              }));
              useLayoutStore.getState().setDetections(roomDetections);
            }
            // Always open zone confirmation modal after analysis
            setZoneConfirm({
              detectedRooms: rooms,
              imageScale: data?.parse_result?.scale_px_per_inch || null,
              imageWidth: data?.parse_result?.image_width || null,
              imageHeight: data?.parse_result?.image_height || null,
              floorPlanUrl: data?.floor_plan_url || null,
            });
            loadRoom(roomId);
            if (rooms.length || data?.parse_result?.walls?.length) {
              setTimeout(() => setShowUpload(false), 1500);
            } else {
              setShowUpload(false);
            }
          }} />
          <RoomPhotoUpload roomId={roomId} onDetectionComplete={(data) => {
            useLayoutStore.getState().setDetections(data.detections || []);
            loadRoom(roomId);
            if (!data.detections?.length) setShowUpload(false);
          }} />
        </div>
      )}

      {/* Analysis Workflow Overlay */}
      {analysisWorkflow && (
        <AnalysisWorkflow
          roomId={roomId}
          file={analysisWorkflow.file}
          onComplete={(data) => {
            setAnalysisWorkflow(null);
            setShowUpload(false);
            const rooms = data?.parse_result?.rooms || [];
            if (rooms.length > 0) {
              const roomDetections = rooms.map(r => ({
                label: r.label,
                score: r.confidence || 0.8,
                bbox: r.bbox || [0, 0, 1, 1],
                polygon: r.polygon,
                type: 'room',
              }));
              useLayoutStore.getState().setDetections(roomDetections);
            }
            // Always open zone confirmation modal after analysis
            // so user can confirm detected rooms or add rooms manually
            setZoneConfirm({
              detectedRooms: rooms,
              imageScale: data?.parse_result?.scale_px_per_inch || null,
              imageWidth: data?.parse_result?.image_width || null,
              imageHeight: data?.parse_result?.image_height || null,
              floorPlanUrl: data?.floor_plan_url || null,
            });
            loadRoom(roomId);
          }}
          onCancel={() => setAnalysisWorkflow(null)}
        />
      )}

      {/* Zone confirmation modal (shown after room analysis) */}
      {zoneConfirm && (
        <ZoneConfirmModal
          detectedRooms={zoneConfirm.detectedRooms}
          imageScale={zoneConfirm.imageScale}
          imageWidth={zoneConfirm.imageWidth}
          imageHeight={zoneConfirm.imageHeight}
          floorPlanUrl={zoneConfirm.floorPlanUrl || room?.floor_plan_url}
          onClose={() => {
            setZoneConfirm(null);
            loadRoom(roomId);
          }}
        />
      )}

      {/* Main editor area */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Catalog panel */}
        <CatalogPanel />

        {/* Center: Canvas + Stats */}
        <div className="flex-1 min-w-0 relative flex flex-col">
          <div className="flex-1 min-h-0 relative">
            {viewMode === '3d' ? (
            <RoomViewer3D
              room={room}
              furniture={furniture}
              selectedId={selectedId}
              onSelect={selectFurniture}
              onUpdate={updateFurniture}
              onRemove={removeFurniture}
              onDeselect={clearSelection}
            />
          ) : (
            <RoomCanvas showClearance={showClearance} />
          )}
          {/* Auto-place error toast */}
          {autoPlaceError && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-lg shadow-md z-20">
              {autoPlaceError}
            </div>
          )}
          {/* Validation results overlay */}
          {validationErrors.length > 0 && (
            <div className="absolute top-3 left-3 bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-lg border border-red-500/20 p-3 z-20 max-w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {validationErrors.length} Layout Issue{validationErrors.length !== 1 ? 's' : ''}
                </p>
                <button onClick={() => setValidationErrors([])} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
              </div>
              <ul className="space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i} className="text-xs text-red-400 flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5 shrink-0">•</span>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {validationErrors.length === 0 && validating === false && furniture.length > 0 && validationErrors !== null && (
            null // success state handled by button text
          )}
          {/* Selection info bar */}
          {selectedItem && viewMode === '2d' && (
            <SelectionBar
              item={selectedItem}
              onRotate={() => {
                const newRot = ((selectedItem.rotation || 0) + 90) % 360;
                const candidate = { ...selectedItem, rotation: newRot };
                const myBox = getAABB(candidate);
                const blocked = furniture.some(other => {
                  if (other.id === selectedItem.id) return false;
                  return overlaps(myBox, getAABB(other));
                });
                if (!blocked) {
                  updateFurniture(selectedId, { rotation: newRot });
                }
              }}
              onDelete={() => removeFurniture(selectedId)}
            />
          )}
          </div>

          {/* Zone selector bar (shown when plan has multiple sub-rooms) */}
          <ZoneSelectorBar />

          {/* Stats bar */}
          <LayoutStatsBar furniture={furniture} room={room} />
        </div>

        {/* Right: Chat panel */}
        {isChatOpen && <ChatPanel roomId={roomId} />}
      </div>
    </div>
  );
}

function SelectionBar({ item, onRotate, onDelete }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [swapItems, setSwapItems] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const { updateFurniture } = useLayoutStore();
  const [posX, setPosX] = useState(String(Math.round(item.x_inches || 0)));
  const [posY, setPosY] = useState(String(Math.round(item.y_inches || 0)));

  useEffect(() => {
    setPosX(String(Math.round(item.x_inches || 0)));
    setPosY(String(Math.round(item.y_inches || 0)));
  }, [item.x_inches, item.y_inches]);

  const applyPosition = () => {
    const x = Math.max(0, Number(posX) || 0);
    const y = Math.max(0, Number(posY) || 0);
    updateFurniture(item.id, { x_inches: x, y_inches: y });
  };

  const loadSwapAlternatives = async () => {
    if (showSwap) { setShowSwap(false); return; }
    setShowSwap(true);
    setShowDetails(false);
    setSwapLoading(true);
    try {
      const params = { category: item.category };
      const { data } = await api.get('/api/furniture/catalog', { params });
      // Filter out the exact same item and sort by price
      setSwapItems((data.items || []).filter(i => i.name !== item.name).slice(0, 6));
    } catch { setSwapItems([]); }
    finally { setSwapLoading(false); }
  };

  const handleSwap = async (catalogItem) => {
    const store = useLayoutStore.getState();
    store._pushUndo();
    // Remove current, add new at same position
    try {
      await api.delete(`/api/furniture/placements/${item.id}`);
      const { data } = await api.post('/api/furniture/placements', {
        room_id: store.room.id,
        catalog_id: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        provider: catalogItem.provider,
        provider_id: catalogItem.provider_id,
        width: catalogItem.width,
        depth: catalogItem.depth,
        height: catalogItem.height,
        x_inches: item.x_inches,
        y_inches: item.y_inches,
        rotation: item.rotation || 0,
        color: item.color || '#d4a27a',
      });
      store.loadRoom(store.room.id);
      setShowSwap(false);
    } catch (err) {
      console.error('Swap failed:', err);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
      {/* Expanded details panel */}
      {showDetails && (
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/10 p-3 w-[340px] animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Properties</p>
            <button onClick={() => setShowDetails(false)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
          </div>

          {/* Position inputs */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-slate-500 font-medium">X Position</label>
              <div className="flex items-center gap-1">
                <input type="number" value={posX} onChange={e => setPosX(e.target.value)}
                  onBlur={applyPosition} onKeyDown={e => e.key === 'Enter' && applyPosition()}
                  className="w-full border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <span className="text-[10px] text-slate-500">"</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-medium">Y Position</label>
              <div className="flex items-center gap-1">
                <input type="number" value={posY} onChange={e => setPosY(e.target.value)}
                  onBlur={applyPosition} onKeyDown={e => e.key === 'Enter' && applyPosition()}
                  className="w-full border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <span className="text-[10px] text-slate-500">"</span>
              </div>
            </div>
          </div>

          {/* Dimensions (read-only) */}
          <div className="flex gap-3 text-xs text-slate-400 mb-2 bg-slate-950 rounded-lg px-2.5 py-1.5">
            <span>{item.width}"W × {item.depth}"D × {item.height || '—'}"H</span>
            <span className="text-slate-600">|</span>
            <span>{item.rotation || 0}°</span>
            {item.category && <>
              <span className="text-slate-600">|</span>
              <span className="capitalize">{item.category.replace('_', ' ')}</span>
            </>}
          </div>

          {/* Provider info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {item.provider && (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize font-medium">{item.provider}</span>
              )}
              {item.price_usd && (
                <span className="text-green-400 font-medium">${item.price_usd}</span>
              )}
            </div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-brand-500 hover:text-brand-400 font-medium flex items-center gap-0.5">
                View product ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Swap alternatives panel */}
      {showSwap && (
        <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/10 p-3 w-[380px] animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Swap with alternative</p>
            <button onClick={() => setShowSwap(false)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
          </div>
          {swapLoading ? (
            <div className="flex items-center justify-center py-4">
              <span className="w-4 h-4 border-2 border-white/10 border-t-brand-500 rounded-full animate-spin" />
              <span className="ml-2 text-xs text-slate-500">Loading alternatives...</span>
            </div>
          ) : swapItems.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-3">No alternatives found in this category</p>
          ) : (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {swapItems.map(alt => (
                <button
                  key={alt.id}
                  onClick={() => handleSwap(alt)}
                  className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-brand-500/10 transition group/swap border border-transparent hover:border-brand-500/30"
                >
                  {alt.image_url ? (
                    <img src={alt.image_url} alt={alt.name} className="w-10 h-10 rounded object-cover bg-slate-800 shrink-0" onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-10 h-10 rounded bg-slate-800 shrink-0 flex items-center justify-center text-[10px] text-slate-500 font-bold">{alt.category?.charAt(0).toUpperCase()}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate group-hover/swap:text-brand-400">{alt.name}</p>
                    <p className="text-[10px] text-slate-500">{alt.width}"W × {alt.depth}"D · {alt.provider}</p>
                  </div>
                  {alt.price_usd && <span className="text-xs text-green-400 font-medium shrink-0">${alt.price_usd}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main selection bar */}
      <div className="bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/10 px-4 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.color || '#d4a27a' }} />
          <div className="text-sm">
            <span className="font-semibold text-white">{item.name}</span>
            <span className="text-slate-500 ml-2 text-xs">{item.width}"×{item.depth}" · {item.rotation || 0}°</span>
          </div>
        </div>
        <div className="w-px h-5 bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setShowDetails(!showDetails); setShowSwap(false); }}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1 ${
              showDetails ? 'border-brand-500/50 bg-brand-500/10 text-brand-400' : 'border-white/10 text-slate-300 hover:bg-slate-800'
            }`}
            title="Properties"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            Info
          </button>
          <button
            onClick={loadSwapAlternatives}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1 ${
              showSwap ? 'border-purple-500/50 bg-purple-500/10 text-purple-400' : 'border-white/10 text-slate-300 hover:bg-slate-800'
            }`}
            title="Swap with alternative"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Swap
          </button>
          <button
            onClick={onRotate}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-white/10 text-slate-300 hover:bg-slate-800 transition flex items-center gap-1"
            title="Rotate 90° (R)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Rotate
          </button>
          <button
            onClick={onDelete}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition flex items-center gap-1"
            title="Delete (Del)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function LayoutStatsBar({ furniture, room }) {
  if (!room) return null;
  const roomArea = (room.width || 0) * (room.depth || 0);
  const furnitureArea = furniture.reduce((sum, f) => {
    const effW = (f.rotation === 90 || f.rotation === 270) ? f.depth : f.width;
    const effD = (f.rotation === 90 || f.rotation === 270) ? f.width : f.depth;
    return sum + (effW || 0) * (effD || 0);
  }, 0);
  const coverage = roomArea > 0 ? Math.round((furnitureArea / roomArea) * 100) : 0;
  const totalCost = furniture.reduce((sum, f) => sum + (Number(f.price_usd) || 0), 0);
  const providers = [...new Set(furniture.map(f => f.provider).filter(Boolean))];

  return (
    <div className="bg-slate-900/70 border-t border-white/10 px-4 py-1.5 flex items-center gap-4 text-xs text-slate-400 shrink-0">
      <span className="flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        <span className="font-medium text-slate-200">{furniture.length}</span> items
      </span>
      <span className="text-slate-600">|</span>
      <span>Coverage: <span className={`font-medium ${coverage > 60 ? 'text-amber-400' : coverage > 40 ? 'text-slate-200' : 'text-slate-200'}`}>{coverage}%</span></span>
      {roomArea > 0 && (
        <>
          <span className="text-slate-600">|</span>
          <span>Room: {(roomArea / 144).toFixed(0)} sq ft</span>
        </>
      )}
      {totalCost > 0 && (
        <>
          <span className="text-slate-600">|</span>
          <span>Total: <span className="font-medium text-green-400">${totalCost.toLocaleString()}</span></span>
        </>
      )}
      {providers.length > 0 && (
        <>
          <span className="text-slate-600">|</span>
          <span className="capitalize">{providers.join(', ')}</span>
        </>
      )}
    </div>
  );
}

function ExportMenu({ roomId }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const room = useLayoutStore((s) => s.room);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleExport = async (format) => {
    setOpen(false);
    try {
      const res = await api.post(`/api/export/${format}/${roomId}`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (room?.name || 'room').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeName}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Export
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-slate-900/70 rounded-xl shadow-xl border border-white/10 py-1.5 z-50 min-w-[140px] animate-in fade-in slide-in-from-top-1">
          {[
            { fmt: 'json', label: 'JSON', desc: 'Data format' },
            { fmt: 'svg', label: 'SVG', desc: 'Vector image' },
            { fmt: 'dxf', label: 'DXF', desc: 'CAD format' },
          ].map(({ fmt, label, desc }) => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              className="w-full text-left px-3 py-2 hover:bg-slate-950 transition flex items-center justify-between group"
            >
              <div>
                <p className="text-sm font-medium text-slate-200 group-hover:text-white">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
