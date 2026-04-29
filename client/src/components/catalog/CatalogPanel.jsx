import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLayoutStore } from '@/store/layoutStore';
import { CATEGORY_COLORS } from '@/utils/constants';
import api from '@/lib/api';

export default function CatalogPanel() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('catalog'); // 'catalog' | 'recommended'
  const initialRender = useRef(true);

  const { recommendedItems, addFurniture, findOpenSlot, room } = useLayoutStore();

  // Auto-switch to Recommended tab when new suggestions arrive
  useEffect(() => {
    if (recommendedItems.length > 0) setTab('recommended');
  }, [recommendedItems]);

  // Load categories once
  useEffect(() => {
    api.get('/api/furniture/categories').then(({ data }) => {
      const list = Array.isArray(data) ? data : [];
      setCategories(list);
    }).catch(() => {});
  }, []);

  // Debounced search — skip initial render to avoid double-fetch
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      search();
      return;
    }
    const t = setTimeout(() => search(), 300);
    return () => clearTimeout(t);
  }, [category, q]);

  const search = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/furniture/catalog', {
        params: { category: category || undefined, q: q || undefined, limit: 40 },
      });
      setItems(data.items || data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onAdd = (it) => {
    if (!room) return;
    const slot = findOpenSlot(it.width, it.depth);
    addFurniture({
      catalog_id: it.id,
      name: it.name,
      category: it.category,
      provider: it.provider,
      provider_id: it.provider_id,
      width: it.width,
      depth: it.depth,
      height: it.height,
      x_inches: slot.x,
      y_inches: slot.y,
      rotation: 0,
      color: CATEGORY_COLORS[it.category] || CATEGORY_COLORS.default,
      image_url: it.image_url || null,
      model_url: it.model_url || null,
    });
    toast.success(`Added ${it.name}`);
  };

  const list = tab === 'recommended' ? recommendedItems : items;

  return (
    <div className="flex flex-col h-full bg-surface-800">
      <div className="p-6 border-b border-surface-700 bg-surface-800">
        <div className="flex gap-4 mb-4 text-[11px] uppercase tracking-editorial">
          <button
            className={tab === 'catalog' ? 'text-surface-100 border-b border-blue-400 pb-1' : 'text-surface-400'}
            onClick={() => setTab('catalog')}
          >
            Catalog
          </button>
          <button
            className={tab === 'recommended' ? 'text-surface-100 border-b border-blue-400 pb-1' : 'text-surface-400'}
            onClick={() => setTab('recommended')}
          >
            Recommended {recommendedItems.length > 0 && `(${recommendedItems.length})`}
          </button>
        </div>

        {tab === 'catalog' && (
          <>
            <input
              className="w-full border border-surface-600 rounded px-3 py-2 text-sm bg-surface-700 text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search furniture…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategory('')}
                className={`text-[10px] uppercase tracking-editorial rounded-full px-3 py-1 border transition ${
                  category === '' ? 'bg-blue-600 text-surface-50 border-blue-600' : 'border-surface-600 text-surface-300 hover:border-surface-400 hover:text-surface-200'
                }`}
              >All</button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-[10px] uppercase tracking-editorial rounded-full px-3 py-1 border transition ${
                    category === c ? 'bg-blue-600 text-surface-50 border-blue-600' : 'border-surface-600 text-surface-300 hover:border-surface-400 hover:text-surface-200'
                  }`}
                >{c.replace(/_/g, ' ')}</button>
              ))}
            </div>
          </>
        )}
        {tab === 'recommended' && recommendedItems.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="text-4xl mb-4">💡</div>
            <div className="text-sm font-medium text-surface-300 mb-2">AI-Powered Suggestions</div>
            <p className="text-xs text-surface-500 leading-relaxed mb-4">
              Ask the Studio assistant to suggest furniture. It will populate this panel with curated picks you can add in one click.
            </p>
            <button
              onClick={() => onOpenChat?.()}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Open AI Assistant
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && tab === 'catalog' && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-surface-600 bg-surface-700 p-4 animate-pulse">
                <div className="aspect-[4/3] mb-3 bg-surface-600 rounded" />
                <div className="h-4 w-3/4 bg-surface-600 rounded mb-2" />
                <div className="h-3 w-1/2 bg-surface-600 rounded mb-3" />
                <div className="h-8 w-full bg-surface-600 rounded-full" />
              </div>
            ))}
          </div>
        )}
        {list.map((it) => (
          <div
            key={it.id || it.catalog_id || it.name}
            className="border border-surface-600 bg-surface-700 hover:border-surface-500 transition group"
          >
            {it.image_url && (
              <div className="aspect-[4/3] overflow-hidden bg-surface-600">
                <img
                  src={it.image_url}
                  alt={it.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex justify-between gap-3 mb-1">
                <div className="text-sm font-medium text-surface-100 truncate">{it.name}</div>
                {it.price_usd != null && (
                  <div className="text-xs text-surface-400 shrink-0">${Number(it.price_usd).toFixed(0)}</div>
                )}
              </div>
              <div className="text-[11px] uppercase tracking-editorial text-surface-400 mb-3">
                {it.provider || 'Catalog'} · {it.width}"W × {it.depth}"D
              </div>
              <button
                onClick={() => onAdd(it)}
                disabled={!room}
                className="w-full text-[10px] uppercase tracking-editorial py-2 border border-surface-600 rounded-full hover:bg-blue-600 hover:text-surface-50 hover:border-blue-600 transition disabled:opacity-40"
              >
                + Add to Room
              </button>
            </div>
          </div>
        ))}
        {!loading && list.length === 0 && tab === 'catalog' && (
          <div className="text-surface-500 text-xs py-10 text-center font-medium">No items found</div>
        )}
      </div>
    </div>
  );
}
