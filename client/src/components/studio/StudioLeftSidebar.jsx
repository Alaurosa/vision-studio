import { useState } from 'react';
import CatalogPanel from '@/components/catalog/CatalogPanel';

export default function StudioLeftSidebar({ catalogOpen, onToggleCatalog }) {
  const [activeTab, setActiveTab] = useState('catalog');

  const tabs = [
    { id: 'catalog', label: 'Catalog', icon: '🛋️' },
    { id: 'uploads', label: 'Uploads', icon: '📁' },
    { id: 'layers', label: 'Layers', icon: '📚' },
    { id: 'materials', label: 'Materials', icon: '🎨' },
  ];

  return (
    <aside className={`
      ${catalogOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      fixed md:relative z-30 md:z-auto inset-y-0 left-0
      w-[320px] border-r border-surface-700 bg-surface-800 overflow-hidden
      transition-transform duration-300 md:transition-none
      top-[calc(4rem+3.5rem)] md:top-0 h-[calc(100vh-4rem-3.5rem)] md:h-auto
      shadow-2xl
    `}>
      {/* Tab Navigation */}
      <div className="flex border-b border-surface-700 bg-surface-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-surface-50 border-b-2 border-blue-400'
                : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700'
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="h-full overflow-hidden">
        {activeTab === 'catalog' && <CatalogPanel />}
        {activeTab === 'uploads' && (
          <div className="h-full flex items-center justify-center text-surface-400">
            <div className="text-center">
              <div className="text-2xl mb-2">📁</div>
              <div className="text-sm font-medium mb-1">Uploads</div>
              <div className="text-xs">Coming soon</div>
            </div>
          </div>
        )}
        {activeTab === 'layers' && (
          <div className="h-full flex items-center justify-center text-surface-400">
            <div className="text-center">
              <div className="text-2xl mb-2">📚</div>
              <div className="text-sm font-medium mb-1">Layers</div>
              <div className="text-xs">Coming soon</div>
            </div>
          </div>
        )}
        {activeTab === 'materials' && (
          <div className="h-full flex items-center justify-center text-surface-400">
            <div className="text-center">
              <div className="text-2xl mb-2">🎨</div>
              <div className="text-sm font-medium mb-1">Materials</div>
              <div className="text-xs">Coming soon</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}