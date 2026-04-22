import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLayoutStore } from '@/store/layoutStore';
import api from '@/lib/api';
import RoomCanvas from '@/components/canvas/RoomCanvas';
import CatalogPanel from '@/components/catalog/CatalogPanel';
import ChatPanel from '@/components/chatbot/ChatPanel';
import RoomViewer3D from '@/components/viewer/RoomViewer3D';
import StudioToolbar from '@/components/studio/StudioToolbar';
import RoomSetupModal from '@/components/studio/RoomSetupModal';
import ZoneBottomBar from '@/components/studio/ZoneBottomBar';
import { ROOM_TEMPLATES } from '@/utils/constants';
import { inchesToFeet } from '@/utils/scale';

export default function Studio() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { room, loadRoom, viewMode, isChatOpen, createRoom } = useLayoutStore();
  const [showSetup, setShowSetup] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Load the requested room, or show a dashboard/setup UI
  useEffect(() => {
    if (roomId) {
      loadRoom(roomId);
    } else {
      fetchRooms();
    }
  }, [roomId]);

  const fetchRooms = async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/api/rooms');
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  const openRoom = (id) => navigate(`/studio/${id}`);

  const createAndEnter = async (payload) => {
    try {
      const room = await createRoom(payload);
      if (room?.id) navigate(`/studio/${room.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRoom = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this room and all its furniture? This cannot be undone.')) return;
    try {
      await api.delete(`/api/rooms/${id}`);
      setRooms((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete room failed:', err);
    }
  };

  // -------- No room selected → room dashboard --------
  if (!roomId) {
    return (
      <div className="max-w-8xl mx-auto px-6 md:px-10 py-20">
        <p className="eyebrow mb-4">Studio</p>
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <h1 className="display-lg max-w-3xl">Your rooms in progress.</h1>
          <button className="btn-ink" onClick={() => setShowSetup(true)}>+ New Room</button>
        </div>

        {loadingList ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="panel p-8 animate-pulse">
                <div className="h-3 w-20 bg-ink-300/30 rounded mb-6" />
                <div className="h-6 w-32 bg-ink-300/30 rounded mb-3" />
                <div className="h-3 w-24 bg-ink-300/30 rounded" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div>
            <p className="text-ink-500 mb-8 max-w-lg leading-relaxed">
              No rooms yet. Pick a template to get started, or create a custom room.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {ROOM_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => createAndEnter({ name: t.name, width: t.width, depth: t.depth, height: t.height })}
                  className="text-left panel p-8 hover:border-ink-900 transition group"
                >
                  <div className="eyebrow mb-6 text-ink-500">Template</div>
                  <div className="display-md mb-3">{t.name}</div>
                  <div className="text-sm text-ink-500">
                    {inchesToFeet(t.width)} × {inchesToFeet(t.depth)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => openRoom(r.id)}
                className="text-left panel p-8 hover:border-ink-900 transition group relative"
              >
                <div className="eyebrow mb-6 text-ink-500">
                  {r.placements?.length || 0} items
                </div>
                <div className="display-md mb-3">{r.name}</div>
                <div className="text-sm text-ink-500">
                  {r.width ? `${inchesToFeet(r.width)} × ${inchesToFeet(r.depth)}` : 'Unsized'}
                </div>
                <button
                  onClick={(e) => deleteRoom(r.id, e)}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border border-red-300 text-red-600 hover:bg-red-600 hover:text-white"
                  aria-label={`Delete ${r.name}`}
                >
                  Delete
                </button>
              </button>
            ))}
          </div>
        )}

        {showSetup && (
          <RoomSetupModal onClose={() => setShowSetup(false)} onCreate={createAndEnter} />
        )}
      </div>
    );
  }

  // -------- Room selected → full editor --------
  if (!room) {
    return (
      <div className="h-[calc(100vh-4rem)] grid place-items-center text-ink-500 eyebrow">
        Loading room…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-paper-100">
      <StudioToolbar onToggleCatalog={() => setCatalogOpen(!catalogOpen)} catalogOpen={catalogOpen} />
      <div className="flex-1 flex overflow-hidden">
        {/* Catalog — collapsible drawer on mobile, fixed sidebar on desktop */}
        <aside className={`
          ${catalogOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          fixed md:relative z-30 md:z-auto inset-y-0 left-0
          w-[320px] border-r border-ink-900/10 bg-paper-50 overflow-y-auto
          transition-transform duration-300 md:transition-none
          top-[calc(4rem+3.5rem)] md:top-0 h-[calc(100vh-4rem-3.5rem)] md:h-auto
        `}>
          <CatalogPanel />
        </aside>

        {/* Backdrop for mobile catalog */}
        {catalogOpen && (
          <div
            className="fixed inset-0 z-20 bg-ink-900/20 md:hidden"
            onClick={() => setCatalogOpen(false)}
          />
        )}

        <section className="relative overflow-hidden flex-1 min-w-0">
          <div className="h-full flex flex-col">
            <div className="min-h-0 flex-1 relative overflow-hidden">
              {viewMode === '3d' ? (
                <RoomViewer3D />
              ) : (
                <RoomCanvas />
              )}
            </div>
            <ZoneBottomBar />
          </div>
        </section>

        {isChatOpen && (
          <aside className="hidden md:flex w-[360px] border-l border-ink-900/10 bg-paper-50 overflow-hidden flex-col">
            <ChatPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
