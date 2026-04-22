import { useEffect, useRef, useState } from 'react';
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
  };

  const list = tab === 'recommended' ? recommendedItems : items;

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-ink-900/10">
        <div className="flex gap-4 mb-4 text-[11px] uppercase tracking-editorial">
          <button
            className={tab === 'catalog' ? 'text-ink-900 border-b border-ink-900 pb-1' : 'text-ink-500'}
            onClick={() => setTab('catalog')}
          >
            Catalog
          </button>
          <button
            className={tab === 'recommended' ? 'text-ink-900 border-b border-ink-900 pb-1' : 'text-ink-500'}
            onClick={() => setTab('recommended')}
          >
            Recommended {recommendedItems.length > 0 && `(${recommendedItems.length})`}
          </button>
        </div>

        {tab === 'catalog' && (
          <>
            <input
              className="input-field mb-4"
              placeholder="Search furniture…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategory('')}
                className={`text-[10px] uppercase tracking-editorial rounded-full px-3 py-1 border transition ${
                  category === '' ? 'bg-ink-900 text-paper-50 border-ink-900' : 'border-ink-900/15 text-ink-700 hover:border-ink-900'
                }`}
              >All</button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-[10px] uppercase tracking-editorial rounded-full px-3 py-1 border transition ${
                    category === c ? 'bg-ink-900 text-paper-50 border-ink-900' : 'border-ink-900/15 text-ink-700 hover:border-ink-900'
                  }`}
                >{c.replace(/_/g, ' ')}</button>
              ))}
            </div>
          </>
        )}
        {tab === 'recommended' && recommendedItems.length === 0 && (
          <p className="text-xs text-ink-500 leading-relaxed">
            Ask the Studio assistant to suggest furniture. It will populate this panel with curated picks you can add in one click.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && tab === 'catalog' && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-ink-900/10 bg-paper-50 p-4 animate-pulse">
                <div className="aspect-[4/3] mb-3 bg-paper-200 rounded" />
                <div className="h-4 w-3/4 bg-paper-300 rounded mb-2" />
                <div className="h-3 w-1/2 bg-paper-200 rounded mb-3" />
                <div className="h-8 w-full bg-paper-200 rounded-full" />
              </div>
            ))}
          </div>
        )}
        {list.map((it) => (
          <div
            key={it.id || it.catalog_id || it.name}
            className="border border-ink-900/10 bg-paper-50 hover:border-ink-900 transition group"
          >
            {it.image_url && (
              <div className="aspect-[4/3] overflow-hidden bg-paper-200">
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
                <div className="text-sm font-medium text-ink-900 truncate">{it.name}</div>
                {it.price_usd != null && (
                  <div className="text-xs text-ink-500 shrink-0">${Number(it.price_usd).toFixed(0)}</div>
                )}
              </div>
              <div className="text-[11px] uppercase tracking-editorial text-ink-500 mb-3">
                {it.provider || 'Catalog'} · {it.width}"W × {it.depth}"D
              </div>
              <button
                onClick={() => onAdd(it)}
                disabled={!room}
                className="w-full text-[10px] uppercase tracking-editorial py-2 border border-ink-900/20 rounded-full hover:bg-ink-900 hover:text-paper-50 transition disabled:opacity-40"
              >
                + Add to Room
              </button>
            </div>
          </div>
        ))}
        {!loading && list.length === 0 && tab === 'catalog' && (
          <div className="text-ink-500 eyebrow py-10 text-center">No items found</div>
        )}
      </div>
    </div>
  );
}
