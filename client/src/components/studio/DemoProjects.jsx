import { motion } from 'framer-motion';
import { DEMO_PROJECTS, ROOM_TEMPLATES } from '@/utils/constants';
import { useLayoutStore } from '@/store/layoutStore';

export default function DemoProjects({ onClose }) {
  const { createRoom, addFurniture } = useLayoutStore();

  const loadDemo = async (demo) => {
    try {
      // Create room from template
      const template = ROOM_TEMPLATES.find(t => t.id === demo.template);
      if (!template) return;

      const roomData = await createRoom({
        name: demo.name,
        width: template.width,
        depth: template.depth,
        height: template.height,
        unit: 'inches'
      });

      // Add demo furniture
      for (const item of demo.furniture) {
        await addFurniture({
          ...item,
          room_id: roomData.id
        });
      }

      onClose();
      // Navigate to the new room
      window.location.href = `/studio/${roomData.id}`;
    } catch (error) {
      console.error('Failed to load demo:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-surface-800 border border-surface-600 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-surface-600">
          <h2 className="text-2xl font-bold text-surface-100">Demo Projects</h2>
          <p className="text-surface-400 mt-1">Explore professionally designed room layouts</p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DEMO_PROJECTS.map((demo) => (
              <motion.div
                key={demo.id}
                whileHover={{ scale: 1.02 }}
                className="bg-surface-700 border border-surface-600 rounded-xl p-6 cursor-pointer hover:border-blue-500/50 transition-colors"
                onClick={() => loadDemo(demo)}
              >
                <div className="aspect-video bg-gradient-to-br from-blue-900/20 to-surface-600 rounded-lg mb-4 flex items-center justify-center">
                  <div className="text-4xl opacity-50">🏠</div>
                </div>
                <h3 className="text-lg font-semibold text-surface-100 mb-2">{demo.name}</h3>
                <p className="text-surface-400 text-sm leading-relaxed">{demo.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-surface-500 bg-surface-600 px-2 py-1 rounded">
                    {demo.furniture.length} items
                  </span>
                  <span className="text-xs text-blue-400 font-medium">Load Demo →</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-surface-600 bg-surface-700/50">
          <button
            onClick={onClose}
            className="w-full bg-surface-600 hover:bg-surface-500 text-surface-200 py-3 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}