import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: 'My Room', width: 180, depth: 144 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [duplicating, setDuplicating] = useState(null); // room id being duplicated

  const ROOM_TEMPLATES = [
    { name: 'Bedroom', icon: '🛏️', width: 144, depth: 132, desc: '12\' × 11\'' },
    { name: 'Living Room', icon: '🛋️', width: 216, depth: 168, desc: '18\' × 14\'' },
    { name: 'Home Office', icon: '💻', width: 120, depth: 120, desc: '10\' × 10\'' },
    { name: 'Studio Apt', icon: '🏠', width: 240, depth: 180, desc: '20\' × 15\'' },
    { name: 'Dining Room', icon: '🍽️', width: 168, depth: 144, desc: '14\' × 12\'' },
  ];

  useEffect(() => {
    loadRooms();
    checkDemoMode();
  }, []);

  const checkDemoMode = async () => {
    try {
      const { data } = await api.get('/api/status');
      if (data.database === 'tables_missing') {
        setDbError('Running in demo mode — data resets on server restart. Set up database for persistence.');
      }
    } catch { /* ignore */ }
  };

  const loadRooms = async () => {
    try {
      const { data } = await api.get('/api/rooms');
      setRooms(data);
      setDbError(null);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      if (err.response?.data?.error?.includes('schema cache') || err.response?.data?.error?.includes('PGRST')) {
        setDbError('Database tables not set up. Running in demo mode — data will be lost on server restart.');
      }
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/api/rooms', {
        name: newRoom.name || 'My Room',
        width: Number(newRoom.width) || 180,
        depth: Number(newRoom.depth) || 144,
      });
      navigate(`/editor/${data.id}`);
    } catch (err) {
      console.error('Failed to create room:', err);
      setCreating(false);
    }
  };

  const deleteRoom = async (roomId) => {
    try {
      await api.delete(`/api/rooms/${roomId}`);
      setRooms(rooms.filter(r => r.id !== roomId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  const duplicateRoom = async (room) => {
    if (duplicating) return;
    setDuplicating(room.id);
    try {
      // Create a new room with same dimensions
      const { data: newRoom } = await api.post('/api/rooms', {
        name: `${room.name} (copy)`,
        width: room.width,
        depth: room.depth,
      });
      // Copy all placements
      const sourcePlacements = room.placements || [];
      for (const p of sourcePlacements) {
        await api.post('/api/furniture/placements', {
          room_id: newRoom.id,
          catalog_id: p.catalog_id,
          name: p.name,
          category: p.category,
          provider: p.provider,
          provider_id: p.provider_id,
          width: p.width,
          depth: p.depth,
          height: p.height,
          x_inches: p.x_inches,
          y_inches: p.y_inches,
          rotation: p.rotation,
          color: p.color,
        });
      }
      await loadRooms();
    } catch (err) {
      console.error('Failed to duplicate room:', err);
    } finally {
      setDuplicating(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/70 border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">Vision Studio</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {dbError && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-300">Demo Mode</p>
              <p className="text-sm text-blue-400 mt-0.5">{dbError}</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Rooms</h1>
            <p className="text-sm text-slate-400 mt-1">{rooms.length} room{rooms.length !== 1 ? 's' : ''} created</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setNewRoom({ name: 'My Room', width: 180, depth: 144 }); }}
            className="bg-brand-500 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-600 transition"
          >
            + New Room
          </button>
        </div>

        {/* Create Room Dialog */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-slate-900 rounded-3xl shadow-xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-4">Create New Room</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Room Name</label>
                  <input
                    type="text"
                    value={newRoom.name}
                    onChange={e => setNewRoom(r => ({ ...r, name: e.target.value }))}
                    className="w-full border border-slate-700 bg-slate-950/80 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Living Room"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Width (inches)</label>
                    <input
                      type="number"
                      value={newRoom.width}
                      onChange={e => setNewRoom(r => ({ ...r, width: e.target.value }))}
                      className="w-full border border-slate-700 bg-slate-950/80 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      min="24"
                      max="1200"
                    />
                    <p className="text-xs text-slate-500 mt-0.5">{(Number(newRoom.width) / 12).toFixed(1)} ft</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Depth (inches)</label>
                    <input
                      type="number"
                      value={newRoom.depth}
                      onChange={e => setNewRoom(r => ({ ...r, depth: e.target.value }))}
                      className="w-full border border-slate-700 bg-slate-950/80 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      min="24"
                      max="1200"
                    />
                    <p className="text-xs text-slate-500 mt-0.5">{(Number(newRoom.depth) / 12).toFixed(1)} ft</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Common sizes: 120"×120" (10'×10'), 180"×144" (15'×12'), 240"×180" (20'×15')</p>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createRoom}
                  disabled={creating}
                  className="bg-brand-500 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-brand-600 transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-slate-900 rounded-3xl shadow-xl p-6 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-2">Delete Room?</h2>
              <p className="text-sm text-slate-400 mb-6">This will permanently delete "{deleteConfirm.name}" and all its furniture placements.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded-lg transition">Cancel</button>
                <button onClick={() => deleteRoom(deleteConfirm.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Quick start templates */}
        {!loading && rooms.length > 0 && (
          <div className="mb-8">
            <p className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Quick Start Templates
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {ROOM_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={async () => {
                    setCreating(true);
                    try {
                      const { data } = await api.post('/api/rooms', { name: t.name, width: t.width, depth: t.depth });
                      navigate(`/editor/${data.id}`);
                    } catch { setCreating(false); }
                  }}
                  disabled={creating}
                  className="shrink-0 bg-slate-900/70 rounded-xl border border-white/10 hover:border-slate-500 transition-all px-4 py-3 text-left group disabled:opacity-50"
                >
                  <span className="text-xl mb-1 block">{t.icon}</span>
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-brand-400 transition">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400">
            <div className="w-8 h-8 border-2 border-slate-600 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading rooms...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-white/10">
              <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No rooms yet</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              Create your first room to start designing with AI-powered layout tools.
            </p>

            {/* Templates for empty state */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Start from a template</p>
            <div className="flex gap-2 justify-center flex-wrap mb-6">
              {ROOM_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={async () => {
                    setCreating(true);
                    try {
                      const { data } = await api.post('/api/rooms', { name: t.name, width: t.width, depth: t.depth });
                      navigate(`/editor/${data.id}`);
                    } catch { setCreating(false); }
                  }}
                  disabled={creating}
                  className="bg-slate-900/70 rounded-xl border border-white/10 hover:border-slate-500 transition-all px-4 py-3 text-left group disabled:opacity-50"
                >
                  <span className="text-xl mb-1 block">{t.icon}</span>
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-brand-400 transition">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-500 mb-3">or create a custom room</p>
            <button
              onClick={() => { setShowCreate(true); setNewRoom({ name: 'My Room', width: 180, depth: 144 }); }}
              className="bg-brand-500 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand-600 transition"
            >
              + New Custom Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-slate-900/70 rounded-3xl border border-white/10 hover:border-slate-500 transition-all duration-200 group relative overflow-hidden"
              >
                {/* Room preview header */}
                <div className="h-28 bg-gradient-to-br from-slate-800 to-slate-900 relative flex items-center justify-center border-b border-white/5">
                  {room.floor_plan_url || room.room_photo_url ? (
                    <img
                      src={room.floor_plan_url || room.room_photo_url}
                      alt={room.name}
                      className="w-full h-full object-cover opacity-40"
                    />
                  ) : (
                    <div className="text-center">
                      <svg className="w-8 h-8 text-slate-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                      </svg>
                    </div>
                  )}
                  {/* Item count badge */}
                  <div className="absolute top-3 right-3 bg-slate-800/90 backdrop-blur-sm text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full border border-white/10">
                    {room.placements?.length || 0} items
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/editor/${room.id}`)}
                  className="w-full text-left p-5"
                >
                  <h3 className="font-semibold text-white group-hover:text-brand-400 transition mb-1.5 text-base">
                    {room.name}
                  </h3>
                  {room.width && room.depth ? (
                    <p className="text-sm text-slate-300">
                      {room.width}" × {room.depth}" <span className="text-slate-500">({(room.width/12).toFixed(0)}' × {(room.depth/12).toFixed(0)}')</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No dimensions set</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {new Date(room.updated_at || room.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(room); }}
                  className="absolute top-3 left-3 w-7 h-7 rounded-lg bg-slate-800/80 backdrop-blur-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center text-xs border border-white/10"
                  title="Delete room"
                  aria-label={`Delete ${room.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateRoom(room); }}
                  disabled={duplicating === room.id}
                  className="absolute top-3 left-12 w-7 h-7 rounded-lg bg-slate-800/80 backdrop-blur-sm text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center text-xs border border-white/10 disabled:opacity-50"
                  title="Duplicate room"
                  aria-label={`Duplicate ${room.name}`}
                >
                  {duplicating === room.id ? (
                    <span className="w-3 h-3 border-2 border-white/10 border-t-brand-500 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
