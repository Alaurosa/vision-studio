import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLayoutStore } from '@/store/layoutStore';
import { inchesToFeet } from '@/utils/scale';
import api from '@/lib/api';

// Simple tooltip component
const TooltipButton = ({ children, tooltip, ...props }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        {...props}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </button>
      {showTooltip && tooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-surface-900 text-surface-100 text-xs rounded shadow-lg whitespace-nowrap z-50">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-surface-900"></div>
        </div>
      )}
    </div>
  );
};

export default function StudioToolbar({ onToggleCatalog, catalogOpen }) {
  const {
    room, viewMode, setViewMode, gridEnabled, toggleGrid,
    isChatOpen, toggleChat, undo, redo, validate, updateRoom,
    selectedId, furniture, rotateFurniture, removeFurniture,
    saveProject, getSavedProjects,
  } = useLayoutStore();
  const [exporting, setExporting] = useState(false);
  const [validationMsg, setValidationMsg] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
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
    <div className="h-14 border-b border-surface-700 bg-surface-800 flex items-center px-4 md:px-6 gap-4 overflow-x-auto shadow-lg">
      {/* Navigation */}
      <div className="flex items-center gap-2 shrink-0">
        <Link to="/studio" className="text-surface-400 hover:text-surface-200 transition-colors text-sm">← Rooms</Link>
        <div className="h-4 w-px bg-surface-600" />
      </div>

      {/* Room Info */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="font-display text-lg text-surface-100 truncate max-w-xs">{room?.name || 'Untitled'}</div>
        <div className="text-xs text-surface-400">
          {room?.width ? `${inchesToFeet(room.width)} × ${inchesToFeet(room.depth)}` : ''}
        </div>
      </div>

      <div className="flex-1 min-w-4" />

      {/* History Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <ToolbarBtn onClick={undo}>↶</ToolbarBtn>
        <ToolbarBtn onClick={redo}>↷</ToolbarBtn>
      </div>

      <div className="h-6 w-px bg-surface-600 shrink-0" />

      {/* View Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <TooltipButton tooltip="2D Layout View" onClick={() => setViewMode('2d')} active={viewMode === '2d'}>2D</TooltipButton>
        <TooltipButton tooltip="3D Walkthrough" onClick={() => setViewMode('3d')} active={viewMode === '3d'}>3D</TooltipButton>
        <TooltipButton tooltip="Toggle Snap Grid" onClick={toggleGrid} active={gridEnabled}>Grid</TooltipButton>
      </div>

      <div className="h-6 w-px bg-surface-600 shrink-0" />

      {/* Tools */}
      <div className="flex items-center gap-1 shrink-0">
        <TooltipButton tooltip="Validate Layout" onClick={doValidate}>✓</TooltipButton>
        <TooltipButton tooltip="Auto-arrange Furniture" onClick={autoPlace}>⟲</TooltipButton>
      </div>

      {/* Selected Item Controls */}
      {selectedId && (
        <>
          <div className="h-6 w-px bg-surface-600 shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            <TooltipButton tooltip="Rotate Left 15°" onClick={() => rotateFurniture(selectedId, (selectedItem?.rotation || 0) - 15)}>↺</TooltipButton>
            <TooltipButton tooltip="Rotate Right 15°" onClick={() => rotateFurniture(selectedId, (selectedItem?.rotation || 0) + 15)}>↻</TooltipButton>
            <TooltipButton tooltip="Delete Item" onClick={() => removeFurniture(selectedId)}>🗑</TooltipButton>
          </div>
        </>
      )}

      <div className="h-6 w-px bg-surface-600 shrink-0" />

      {/* Save/Load */}
      <div className="flex items-center gap-1 shrink-0">
        <TooltipButton tooltip="Save Project" onClick={saveProject}>💾</TooltipButton>
        <TooltipButton tooltip="Load Project" onClick={() => setShowLoadMenu(!showLoadMenu)}>📁</TooltipButton>
      </div>

      <div className="h-6 w-px bg-surface-600 shrink-0" />

      {/* Export */}
      <div className="flex items-center gap-1 shrink-0">
        <TooltipButton tooltip="Export as JSON" onClick={() => runExport('json')} disabled={exporting}>JSON</TooltipButton>
        <TooltipButton tooltip="Export as SVG" onClick={() => runExport('svg')} disabled={exporting}>SVG</TooltipButton>
        <TooltipButton tooltip="Export as DXF" onClick={() => runExport('dxf')} disabled={exporting}>DXF</TooltipButton>
      </div>

      {/* Validation Message */}
      {validationMsg && (
        <div className="text-xs text-blue-400 bg-blue-900/20 px-3 py-1 rounded shrink-0">
          {validationMsg}
        </div>
      )}

      {/* Load Menu */}
      {showLoadMenu && (
        <div className="absolute top-full right-0 mt-2 bg-surface-800 border border-surface-600 rounded-lg shadow-xl z-50 min-w-64">
          <div className="p-3 border-b border-surface-600">
            <div className="text-sm font-medium text-surface-200">Load Project</div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {getSavedProjects().length === 0 ? (
              <div className="p-4 text-center text-surface-500 text-sm">
                No saved projects yet
              </div>
            ) : (
              getSavedProjects().map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    // Load project and navigate
                    window.location.href = `/studio/${project.id}`;
                    setShowLoadMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-surface-700 border-b border-surface-700/50 last:border-b-0"
                >
                  <div className="text-sm text-surface-200 font-medium">{project.name}</div>
                  <div className="text-xs text-surface-500">
                    {project.furniture?.length || 0} items • {new Date(project.timestamp).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({ active, children, tooltip, className = '', ...props }) {
  return (
    <TooltipButton
      {...props}
      tooltip={tooltip}
      className={`shrink-0 text-xs px-3 py-1.5 rounded transition-colors font-medium ${
        active
          ? 'bg-blue-600 text-surface-50 shadow-sm'
          : 'text-surface-300 hover:text-surface-100 hover:bg-surface-700'
      } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </TooltipButton>
  );
}
