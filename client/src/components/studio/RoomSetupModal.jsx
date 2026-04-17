import { useState } from 'react';
import { ROOM_TEMPLATES } from '@/utils/constants';

export default function RoomSetupModal({ onClose, onCreate }) {
  const [name, setName] = useState('My Room');
  const [w, setW] = useState(180);
  const [d, setD] = useState(144);
  const [h, setH] = useState(96);

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-paper-50 border border-ink-900/10 w-full max-w-xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow mb-4">New Room</div>
        <h2 className="display-md mb-8">Define your space</h2>
        <label className="block mb-6">
          <div className="eyebrow mb-2 text-ink-600">Room name</div>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <label>
            <div className="eyebrow mb-2 text-ink-600">Width (in)</div>
            <input type="number" className="input-field" value={w} onChange={(e) => setW(+e.target.value)} />
          </label>
          <label>
            <div className="eyebrow mb-2 text-ink-600">Depth (in)</div>
            <input type="number" className="input-field" value={d} onChange={(e) => setD(+e.target.value)} />
          </label>
          <label>
            <div className="eyebrow mb-2 text-ink-600">Height (in)</div>
            <input type="number" className="input-field" value={h} onChange={(e) => setH(+e.target.value)} />
          </label>
        </div>

        <div className="eyebrow mb-3 text-ink-600">Or start from a template</div>
        <div className="flex flex-wrap gap-2 mb-8">
          {ROOM_TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="border border-ink-900/15 rounded-full px-4 py-1.5 text-xs hover:bg-ink-900 hover:text-paper-50 transition"
              onClick={() => { setName(t.name); setW(t.width); setD(t.depth); setH(t.height); }}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-ink" onClick={() => onCreate({ name, width: w, depth: d, height: h })}>
            Create Room
          </button>
        </div>
      </div>
    </div>
  );
}
