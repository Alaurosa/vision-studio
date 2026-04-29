import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLayoutStore } from '@/store/layoutStore';
import ChatPanel from '@/components/chatbot/ChatPanel';
import ZoneBottomBar from '@/components/studio/ZoneBottomBar';

export default function StudioBottomDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const { isChatOpen } = useLayoutStore();

  const tabs = [
    { id: 'chat', label: 'AI Assistant', icon: '🤖' },
    { id: 'zones', label: 'Room Zones', icon: '🏠' },
  ];

  return (
    <>
      {/* Drawer Toggle */}
      <div className="border-t border-surface-700 bg-surface-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsOpen(true);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
                activeTab === tab.id && isOpen
                  ? 'bg-blue-600 text-surface-50'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-surface-400 hover:text-surface-200 transition-colors"
        >
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {/* Drawer Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '400px', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smoother feel
              opacity: { duration: 0.2 }
            }}
            className="border-t border-surface-700 bg-surface-800 overflow-hidden shadow-2xl"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="h-full"
            >
              {activeTab === 'chat' && <ChatPanel />}
              {activeTab === 'zones' && <ZoneBottomBar />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}