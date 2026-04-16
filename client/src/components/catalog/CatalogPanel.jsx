import { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { useLayoutStore } from '../../store/layoutStore';
import { CATEGORY_COLORS } from '../../utils/constants';
import { getAABB, overlaps } from '../../utils/collision';
import { toast } from '../ui/Toast';

const CATEGORIES = ['all', 'sofa', 'bed', 'desk', 'bookshelf', 'dining_table', 'coffee_table', 'dresser', 'nightstand', 'armchair', 'tv_stand'];

export default function CatalogPanel() {
  const { addFurniture, room, recommendedItems, clearRecommendedItems } = useLayoutStore();
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // Debounce search input — fire immediately on category change, debounce on text search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadCatalog();
    }, search ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [category, search]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const params = {};
      if (category !== 'all') params.category = category;
      if (search) params.q = search;
      const { data } = await api.get('/api/furniture/catalog', { params });
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const [adding, setAdding] = useState(null); // catalog item id currently being added

  const handleAdd = async (catalogItem) => {
    if (!room || adding) return;
    setAdding(catalogItem.id);
    try {
      // Find an open (non-overlapping) slot by walking a 6" grid
      const existing = useLayoutStore.getState().furniture;
      const step = 6;
      const w = catalogItem.width || 30;
      const d = catalogItem.depth || 30;
      const maxX = Math.max(step, (room.width || 240) - w);
      const maxY = Math.max(step, (room.depth || 240) - d);

      let best = { x: step, y: step };
      let found = false;
      outer: for (let y = step; y <= maxY; y += step) {
        for (let x = step; x <= maxX; x += step) {
          const candidate = { x_inches: x, y_inches: y, width: w, depth: d, rotation: 0 };
          const box = getAABB(candidate);
          const collides = existing.some((f) => overlaps(box, getAABB(f)));
          if (!collides) {
            best = { x, y };
            found = true;
            break outer;
          }
        }
      }
      // If the room is too packed, fall back to top-left (user can reposition)
      if (!found) best = { x: step, y: step };

      await addFurniture({
        catalog_id: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        provider: catalogItem.provider,
        provider_id: catalogItem.provider_id,
        width: catalogItem.width,
        depth: catalogItem.depth,
        height: catalogItem.height,
        image_url: catalogItem.image_url,
        x_inches: best.x,
        y_inches: best.y,
        rotation: 0,
        color: CATEGORY_COLORS[catalogItem.category] || CATEGORY_COLORS.default,
      });
      toast.success(`Added ${catalogItem.name}`);
      if (!found) {
        toast.info('Room is getting crowded — placed at top-left. Move it where you like.');
      }
    } catch (err) {
      console.error('Failed to add furniture:', err);
      toast.error('Could not add furniture. Please try again.');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="w-[300px] shrink-0 bg-slate-900/70 border-r border-white/10 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-200">Furniture Catalog</h2>
          <span className="text-xs text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full">{items.length} items</span>
        </div>
        <div className="relative">
          <svg className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search furniture..."
            className="w-full border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-slate-900 transition"
          />
        </div>
      </div>

      {/* Category tabs — horizontal scroll */}
      <div className="px-3 py-2 border-b border-white/10 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded-full transition whitespace-nowrap shrink-0 ${
                category === cat
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800 bg-slate-950'
              }`}
            >
              {cat === 'all' ? 'All' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {/* AI Recommended items */}
        {recommendedItems.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">✨ AI Recommended</p>
              <button onClick={clearRecommendedItems} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
            </div>
            {recommendedItems.map((item) => (
              <div
                key={item.id}
                className="bg-brand-500/10 rounded-lg p-3 border-2 border-brand-500/30 mb-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white truncate block hover:text-brand-500 transition">{item.name}</a>
                    ) : (
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.width}"W × {item.depth}"D × {item.height}"H
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 capitalize">{item.provider}</span>
                      {item.price_usd && (
                        <span className="text-xs font-medium text-green-400">${item.price_usd}</span>
                      )}
                    </div>
                  </div>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-md object-cover shrink-0 ml-2 bg-slate-800" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-md shrink-0 ml-2 flex items-center justify-center text-xs text-white font-bold" style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default }}>
                      {item.category?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleAdd(item)}
                  disabled={adding === item.id}
                  className="mt-2 w-full text-xs font-medium py-1.5 rounded-md bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50"
                >
                  {adding === item.id ? 'Adding...' : '+ Add to Room'}
                </button>
              </div>
            ))}
            <div className="border-b border-white/10 mt-1" />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/10 border-t-brand-500 rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-500">Loading catalog...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <p className="text-sm font-medium text-slate-400 mb-0.5">No items found</p>
            <p className="text-xs text-slate-500">Try adjusting your search or category filter</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-950 rounded-lg p-3 border border-white/10 hover:border-brand-500/30 transition group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white truncate block hover:text-brand-500 transition">{item.name}</a>
                  ) : (
                    <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.width}"W × {item.depth}"D × {item.height}"H
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 capitalize">{item.provider}</span>
                    {item.price_usd && (
                      <span className="text-xs font-medium text-green-400">
                        ${item.price_usd}
                      </span>
                    )}
                  </div>
                </div>
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-12 h-12 rounded-md object-cover shrink-0 ml-2 bg-slate-800"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-md shrink-0 ml-2 flex items-center justify-center text-xs text-white font-bold"
                    style={{ backgroundColor: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default }}
                  >
                    {item.category?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleAdd(item)}
                disabled={adding === item.id}
                className="mt-2 w-full text-xs font-medium py-1.5 rounded-md bg-slate-900/70 border border-white/10 text-slate-300 hover:bg-brand-500 hover:text-white hover:border-brand-500 transition disabled:opacity-50"
              >
                {adding === item.id ? 'Adding...' : '+ Add to Room'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
