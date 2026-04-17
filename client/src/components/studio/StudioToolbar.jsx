import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLayoutStore } from '@/store/layoutStore';
import api from '@/lib/api';

export default function StudioToolbar() {
  const {
    room, viewMode, setViewMode, gridEnabled, toggleGrid,
    isChatOpen, toggleChat, undo, redo, validate, updateRoom,
    selectedId, furniture, rotateFurniture, removeFurniture,
  } = useLayoutStore();
  const [exporting, setExporting] = useState(false);
  const [validationMsg, setValidationMsg] = useState(null);
  const selectedItem = furniture.find((item) => item.id === selectedId);

  const runExport = async (format) => {
    if (!room?.id) return;
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
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const doValidate = () => {
    const { valid, errors } = validate();
    setValidationMsg(valid ? 'Layout looks clean — no overlaps or overflow.' : errors.slice(0, 4).join(' · '));
    setTimeout(() => setValidationMsg(null), 5000);
  };

  const autoPlace = async () => {
    if (!room?.id) return;
    try {
      await api.post('/api/layout/auto-place', { room_id: room.id });
      // reload furniture
      const { data } = await api.get(`/api/rooms/${room.id}`);
      useLayoutStore.setState({ furniture: data.placements || [] });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="h-14 border-b border-ink-900/10 bg-paper-50 flex items-center px-6 gap-4">
      <Link to="/studio" className="eyebrow text-ink-500 hover:text-ink-900">← Rooms</Link>
      <div className="h-5 w-px bg-ink-900/15" />
      <div className="font-display text-lg truncate max-w-xs">{room?.name || 'Untitled'}</div>
      <div className="text-xs text-ink-500">
        {room?.width ? `${(room.width/12).toFixed(1)}' × ${(room.depth/12).toFixed(1)}'` : ''}
      </div>

      <div className="flex-1" />

      {validationMsg && (
        <span className="text-[11px] uppercase tracking-editorial text-sienna-600">{validationMsg}</span>
      )}

      <ToolbarBtn onClick={undo}>Undo</ToolbarBtn>
      <ToolbarBtn onClick={redo}>Redo</ToolbarBtn>
      <ToolbarBtn onClick={toggleGrid} active={gridEnabled}>Grid</ToolbarBtn>
      <ToolbarBtn onClick={doValidate}>Validate</ToolbarBtn>
      <ToolbarBtn onClick={autoPlace}>Auto-Arrange</ToolbarBtn>
      {selectedId && (
        <>
          <div className="h-5 w-px bg-ink-900/15" />
          <ToolbarBtn onClick={() => rotateFurniture(selectedId, (selectedItem?.rotation || 0) - 15)}>Rotate -</ToolbarBtn>
          <ToolbarBtn onClick={() => rotateFurniture(selectedId, (selectedItem?.rotation || 0) + 15)}>Rotate +</ToolbarBtn>
          <ToolbarBtn onClick={() => removeFurniture(selectedId)}>Delete</ToolbarBtn>
        </>
      )}
      <div className="h-5 w-px bg-ink-900/15" />
      <ToolbarBtn onClick={() => setViewMode('2d')} active={viewMode === '2d'}>2D</ToolbarBtn>
      <ToolbarBtn onClick={() => setViewMode('3d')} active={viewMode === '3d'}>3D</ToolbarBtn>
      <div className="h-5 w-px bg-ink-900/15" />
      <ToolbarBtn onClick={() => runExport('json')} disabled={exporting}>JSON</ToolbarBtn>
      <ToolbarBtn onClick={() => runExport('svg')} disabled={exporting}>SVG</ToolbarBtn>
      <ToolbarBtn onClick={() => runExport('dxf')} disabled={exporting}>DXF</ToolbarBtn>
      <div className="h-5 w-px bg-ink-900/15" />
      <ToolbarBtn onClick={toggleChat} active={isChatOpen}>Chat</ToolbarBtn>
    </div>
  );
}

function ToolbarBtn({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={`text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border transition
        ${active
          ? 'bg-ink-900 text-paper-50 border-ink-900'
          : 'border-ink-900/20 text-ink-700 hover:border-ink-900 hover:text-ink-900'}
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
