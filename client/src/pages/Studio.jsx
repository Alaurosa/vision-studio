import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
<<<<<<< Updated upstream
=======
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
>>>>>>> Stashed changes
import { useLayoutStore } from '@/store/layoutStore';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import RoomCanvas from '@/components/canvas/RoomCanvas';
import CatalogPanel from '@/components/catalog/CatalogPanel';
import ChatPanel from '@/components/chatbot/ChatPanel';
import RoomViewer3D from '@/components/viewer/RoomViewer3D';
import StudioToolbar from '@/components/studio/StudioToolbar';
import RoomSetupModal from '@/components/studio/RoomSetupModal';
import ZoneBottomBar from '@/components/studio/ZoneBottomBar';
import ConfirmModal from '@/components/ConfirmModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ROOM_TEMPLATES } from '@/utils/constants';
import { inchesToFeet } from '@/utils/scale';

const isDraftId = (id) => typeof id === 'string' && id.startsWith('draft-');

export default function Studio() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    room, loadRoom, viewMode, isChatOpen, createRoom, createDraftRoom, clearDraft,
  } = useLayoutStore();
  const [showSetup, setShowSetup] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const draftRoom = useLayoutStore((s) => (isDraftId(s.room?.id) ? s.room : null));

  // Confirm modal state
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Load the requested room, or show a dashboard/setup UI
  useEffect(() => {
    if (roomId) {
      loadRoom(roomId);
    } else if (user) {
      fetchRooms();
    } else {
      setRooms([]);
      setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user]);

  const fetchRooms = async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/api/rooms');
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Failed to load rooms');
    } finally {
      setLoadingList(false);
    }
  };

  const openRoom = (id) => navigate(`/studio/${id}`);

  const createAndEnter = async (payload) => {
    try {
<<<<<<< Updated upstream
      if (!user) {
        const draft = createDraftRoom(payload);
        navigate(`/studio/${draft.id}`);
        return;
      }
      const newRoom = await createRoom(payload);
      if (newRoom?.id) navigate(`/studio/${newRoom.id}`);
=======
      const room = await createRoom(payload);
      if (room?.id) {
        toast.success(`Created "${payload.name}"`);
        navigate(`/studio/${room.id}`);
      }
>>>>>>> Stashed changes
    } catch (e) {
      toast.error('Failed to create room');
    }
  };

  const deleteRoom = async (id) => {
    try {
      await api.delete(`/api/rooms/${id}`);
      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success('Room deleted');
    } catch (err) {
      toast.error('Failed to delete room');
    }
  };

  const discardDraft = () => {
    if (!window.confirm('Discard your draft? This cannot be undone.')) return;
    clearDraft();
  };

  // -------- No room selected → dashboard --------
  if (!roomId) {
    const waitingForAuth = authLoading;
    const guest = !user && !authLoading;

    return (
<<<<<<< Updated upstream
      <div className="max-w-8xl mx-auto px-6 md:px-10 py-20">
        <p className="eyebrow mb-4">Studio</p>
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <h1 className="display-lg max-w-3xl">
            {guest ? 'Start designing in seconds.' : 'Your rooms in progress.'}
          </h1>
          <button className="btn-ink" onClick={() => setShowSetup(true)}>+ New Room</button>
        </div>

        {/* Guest: show any in-progress draft prominently */}
        {guest && draftRoom && (
          <div className="panel p-8 mb-10 border-ink-900 flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="eyebrow mb-2 text-sienna-600">Your draft</div>
              <div className="display-md mb-2">{draftRoom.name}</div>
              <div className="text-sm text-ink-500">
                {draftRoom.width ? `${inchesToFeet(draftRoom.width)} × ${inchesToFeet(draftRoom.depth)}` : 'Unsized'} · not saved to any account
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-ink" onClick={() => openRoom(draftRoom.id)}>Continue editing →</button>
              <button
                onClick={discardDraft}
                className="text-[11px] uppercase tracking-editorial text-ink-500 hover:text-ink-900 px-4"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Guest: no draft yet → show templates + upload CTA */}
        {guest && !draftRoom && (
          <div>
            <p className="text-ink-500 mb-8 max-w-lg leading-relaxed">
              No sign-in required. Pick a template to start from scratch, or upload a floorplan to design your real space.
              Save to your account whenever you're ready.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {ROOM_TEMPLATES.map((t) => (
=======
      <>
        <Helmet>
          <title>Studio — Vision Studio</title>
        </Helmet>
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
              <div className="text-center py-16 mb-12">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-paper-200 grid place-items-center">
                  <span className="text-3xl">🏠</span>
                </div>
                <h2 className="display-md mb-3">No rooms yet</h2>
                <p className="text-ink-500 mb-8 max-w-md mx-auto leading-relaxed">
                  Pick a template below to get started, or create a custom room with your own dimensions.
                </p>
              </div>
              <p className="eyebrow mb-4">Quick Start Templates</p>
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
>>>>>>> Stashed changes
                <button
                  key={r.id}
                  onClick={() => openRoom(r.id)}
                  className="text-left panel p-8 hover:border-ink-900 transition group relative"
                >
                  <div className="eyebrow mb-6 text-ink-500">
                    {r.placements?.length || 0} item{(r.placements?.length || 0) !== 1 ? 's' : ''}
                  </div>
                  <div className="display-md mb-3">{r.name}</div>
                  <div className="text-sm text-ink-500">
                    {r.width ? `${inchesToFeet(r.width)} × ${inchesToFeet(r.depth)}` : 'Unsized'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmTarget(r);
                    }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border border-red-300 text-red-600 hover:bg-red-600 hover:text-white"
                    aria-label={`Delete ${r.name}`}
                  >
                    Delete
                  </button>
                </button>
              ))}
            </div>
<<<<<<< Updated upstream
            <div className="panel p-8 flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="eyebrow mb-2 text-ink-500">Have a floorplan?</div>
                <div className="display-md">Upload & auto-segment your rooms.</div>
              </div>
              <button className="btn-ink" onClick={() => navigate('/upload')}>Upload floorplan →</button>
            </div>
          </div>
        )}

        {/* Authed: existing "your rooms" flow */}
        {!guest && !waitingForAuth && (
          loadingList ? (
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
          )
        )}

        {waitingForAuth && (
          <div className="text-ink-500 eyebrow">Loading…</div>
        )}
=======
          )}
>>>>>>> Stashed changes

          {showSetup && (
            <RoomSetupModal onClose={() => setShowSetup(false)} onCreate={createAndEnter} />
          )}

          <ConfirmModal
            open={!!confirmTarget}
            title={`Delete "${confirmTarget?.name}"?`}
            message="This room and all its furniture will be permanently deleted. This action cannot be undone."
            confirmLabel="Delete Room"
            danger
            onConfirm={() => {
              if (confirmTarget) deleteRoom(confirmTarget.id);
              setConfirmTarget(null);
            }}
            onCancel={() => setConfirmTarget(null)}
          />
        </div>
      </>
    );
  }

  // -------- Room selected → full editor --------
  if (!room) {
    return (
      <div className="h-[calc(100vh-4rem)] grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-ink-300 border-t-ink-900 rounded-full animate-spin" />
          <span className="eyebrow text-ink-500">Loading room…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{room.name || 'Untitled'} — Vision Studio</title>
      </Helmet>
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
          <AnimatePresence>
            {catalogOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-20 bg-ink-900/20 md:hidden"
                onClick={() => setCatalogOpen(false)}
              />
            )}
          </AnimatePresence>

          <section className="relative overflow-hidden flex-1 min-w-0">
            <div className="h-full flex flex-col">
              <div className="min-h-0 flex-1 relative overflow-hidden">
                <ErrorBoundary>
                  {viewMode === '3d' ? (
                    <RoomViewer3D />
                  ) : (
                    <RoomCanvas />
                  )}
                </ErrorBoundary>
              </div>
              <ZoneBottomBar />
            </div>
          </section>

          {/* Chat panel — slide-in on desktop */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="hidden md:flex border-l border-ink-900/10 bg-paper-50 overflow-hidden flex-col"
              >
                <ChatPanel />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile chat overlay */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden fixed inset-x-0 bottom-0 top-16 z-40 bg-paper-50 flex flex-col border-t border-ink-900/10"
            >
              <ChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
