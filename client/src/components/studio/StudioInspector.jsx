import { useState } from 'react';
import { useLayoutStore } from '@/store/layoutStore';
import { inchesToFeet } from '@/utils/scale';

export default function StudioInspector() {
  const { room, selectedId, furniture, updateFurniture, removeFurniture, rotateFurniture, addFurniture } = useLayoutStore();
  const selectedItem = furniture.find((item) => item.id === selectedId);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const handleNameEdit = () => {
    if (selectedItem) {
      setTempName(selectedItem.name);
      setEditingName(true);
    }
  };

  const handleNameSave = () => {
    if (selectedItem && tempName.trim()) {
      updateFurniture(selectedItem.id, { name: tempName.trim() });
    }
    setEditingName(false);
  };

  const handleNameCancel = () => {
    setEditingName(false);
    setTempName('');
  };

  const handleDuplicate = () => {
    if (selectedItem) {
      const duplicate = {
        ...selectedItem,
        name: `${selectedItem.name} (copy)`,
        x_inches: selectedItem.x_inches + 12,
        y_inches: selectedItem.y_inches + 12,
      };
      delete duplicate.id;
      addFurniture(duplicate);
    }
  };

  const handleDelete = () => {
    if (selectedItem) {
      removeFurniture(selectedItem.id);
    }
  };

  const handleColorChange = (color) => {
    if (selectedItem) {
      updateFurniture(selectedItem.id, { color });
    }
  };

  const colorOptions = [
    '#d4a27a', '#8b5a3c', '#2c1810', '#f5f5f0', '#e8e8e8',
    '#4a4a4a', '#1a1a1a', '#3b82f6', '#ef4444', '#10b981'
  ];

  return (
    <aside className="w-[280px] border-l border-surface-700 bg-surface-800 shadow-2xl overflow-y-auto">
      <div className="p-4 border-b border-surface-700">
        <div className="eyebrow text-surface-300 mb-1">Inspector</div>
        <div className="text-sm font-medium text-surface-100">Properties</div>
      </div>

      <div className="p-4 space-y-6">
        {/* Room Info */}
        <div>
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Room</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Dimensions</label>
              <div className="text-sm text-surface-100 font-mono bg-surface-700 px-3 py-2 rounded">
                {room?.width ? `${inchesToFeet(room.width)} × ${inchesToFeet(room.depth)}` : '—'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Height</label>
              <div className="text-sm text-surface-100 font-mono bg-surface-700 px-3 py-2 rounded">
                {room?.height ? `${Math.round(room.height / 12)}'` : '—'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Flooring</label>
              <select className="w-full bg-surface-700 border border-surface-600 text-surface-100 text-sm px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option>Hardwood</option>
                <option>Carpet</option>
                <option>Tile</option>
                <option>Laminate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-400 mb-1">Style</label>
              <select className="w-full bg-surface-700 border border-surface-600 text-surface-100 text-sm px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option>Modern</option>
                <option>Traditional</option>
                <option>Minimalist</option>
                <option>Industrial</option>
                <option>Scandinavian</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selected Item */}
        {selectedItem ? (
          <div>
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Selected Item</div>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs text-surface-400 mb-1">Name</label>
                {editingName ? (
                  <div className="flex gap-2">
                    <input
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameSave();
                        if (e.key === 'Escape') handleNameCancel();
                      }}
                      className="flex-1 bg-surface-700 border border-surface-600 text-surface-100 text-sm px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    <button onClick={handleNameSave} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">✓</button>
                    <button onClick={handleNameCancel} className="px-2 py-1 bg-surface-600 text-surface-300 text-xs rounded hover:bg-surface-500">✕</button>
                  </div>
                ) : (
                  <div
                    onClick={handleNameEdit}
                    className="text-sm text-surface-100 bg-surface-700 px-3 py-2 rounded cursor-pointer hover:bg-surface-600 transition-colors"
                  >
                    {selectedItem.name}
                  </div>
                )}
              </div>

              {/* Dimensions */}
              <div>
                <label className="block text-xs text-surface-400 mb-1">Dimensions</label>
                <div className="text-sm text-surface-100 font-mono bg-surface-700 px-3 py-2 rounded">
                  {selectedItem.width}" × {selectedItem.depth}" × {selectedItem.height || 30}"
                </div>
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-surface-400 mb-1">X Position</label>
                  <input
                    type="number"
                    value={selectedItem.x_inches}
                    onChange={(e) => updateFurniture(selectedItem.id, { x_inches: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-surface-700 border border-surface-600 text-surface-100 text-sm px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    step="0.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-surface-400 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={selectedItem.y_inches}
                    onChange={(e) => updateFurniture(selectedItem.id, { y_inches: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-surface-700 border border-surface-600 text-surface-100 text-sm px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    step="0.5"
                  />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="block text-xs text-surface-400 mb-1">Rotation</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="270"
                    step="90"
                    value={selectedItem.rotation || 0}
                    onChange={(e) => updateFurniture(selectedItem.id, { rotation: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    {[0, 90, 180, 270].map((angle) => (
                      <button
                        key={angle}
                        onClick={() => updateFurniture(selectedItem.id, { rotation: angle })}
                        className={`px-2 py-1 text-xs rounded ${
                          (selectedItem.rotation || 0) === angle
                            ? 'bg-blue-600 text-white'
                            : 'bg-surface-600 text-surface-300 hover:bg-surface-500'
                        }`}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs text-surface-400 mb-1">Color</label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className={`w-8 h-8 rounded border-2 ${
                        selectedItem.color === color
                          ? 'border-white'
                          : 'border-surface-600 hover:border-surface-400'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={selectedItem.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-full h-8 bg-surface-700 border border-surface-600 rounded cursor-pointer"
                />
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={handleDuplicate}
                  className="w-full text-left px-3 py-2 text-sm bg-surface-700 hover:bg-surface-600 text-surface-200 rounded transition-colors"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Selected Item</div>
            <div className="text-sm text-surface-500 italic py-4 text-center">
              Click on furniture to edit properties
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}