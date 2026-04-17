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
import { ROOM_TEMPLATES } from '@/utils/constants';

export default function Studio() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { room, loadRoom, viewMode, isChatOpen, createRoom } = useLayoutStore();
  const [showSetup, setShowSetup] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

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
          <div className="text-ink-500 eyebrow">Loading rooms…</div>
        ) : rooms.length === 0 ? (
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
                  {(t.width / 12).toFixed(1)}' × {(t.depth / 12).toFixed(1)}'
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => openRoom(r.id)}
                className="text-left panel p-8 hover:border-ink-900 transition"
              >
                <div className="eyebrow mb-6 text-ink-500">
                  {r.placements?.length || 0} items
                </div>
                <div className="display-md mb-3">{r.name}</div>
                <div className="text-sm text-ink-500">
                  {r.width ? `${(r.width/12).toFixed(1)}' × ${(r.depth/12).toFixed(1)}'` : 'Unsized'}
                </div>
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
      <StudioToolbar />
      <div className="flex-1 grid grid-cols-[320px_minmax(0,1fr)_auto] overflow-hidden">
        <aside className="border-r border-ink-900/10 bg-paper-50 overflow-y-auto">
          <CatalogPanel />
        </aside>

        <section className="relative overflow-hidden">
          {viewMode === '3d' ? (
            <RoomViewer3D />
          ) : (
            <RoomCanvas />
          )}
        </section>

        {isChatOpen && (
          <aside className="w-[360px] border-l border-ink-900/10 bg-paper-50 overflow-hidden flex flex-col">
            <ChatPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
