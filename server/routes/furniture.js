import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback, hasDbUserId, roomOwnedByUser } from '../services/db.js';

const router = express.Router();

// GET /api/furniture/catalog?category=sofa&provider=ikea&q=billy
router.get('/catalog', async (req, res) => {
  const { category, provider, q, limit = 50, offset = 0 } = req.query;

  if (await useDb()) {
    let query = supabaseAdmin.from('furniture_catalog').select('*', { count: 'exact' }).eq('available', true);
    if (category) query = query.eq('category', category);
    if (provider) query = query.eq('provider', provider);
    if (q) query = query.ilike('name', `%${q}%`);
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1).order('name');
    const { data, error, count } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ items: data, total: count });
  }
  // Fallback
  const result = fallback.getCatalog({ category, provider, q, limit: Number(limit), offset: Number(offset) });
  res.json(result);
});

// GET /api/furniture/catalog/:id
router.get('/catalog/:id', async (req, res) => {
  if (await useDb()) {
    const { data, error } = await supabaseAdmin
      .from('furniture_catalog')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  }
  const item = fallback.getCatalogItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// GET /api/furniture/categories
router.get('/categories', async (req, res) => {
  if (await useDb()) {
    const { data, error } = await supabaseAdmin
      .from('furniture_catalog')
      .select('category')
      .eq('available', true);
    if (error) return res.status(400).json({ error: error.message });
    const unique = [...new Set(data.map((d) => d.category))].sort();
    return res.json(unique);
  }
  res.json(fallback.getCategories());
});

// POST /api/furniture/placements — add furniture to a room
router.post('/placements', optionalAuth, async (req, res) => {
  const {
    room_id,
    catalog_id,
    name,
    category,
    provider,
    provider_id,
    width,
    depth,
    height,
    x_inches,
    y_inches,
    rotation,
    color,
    custom,
    zone_id,
    image_url,
    model_url,
  } = req.body;

  if (!room_id) return res.status(400).json({ error: 'room_id is required' });

  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (!(await roomOwnedByUser(room_id, req.user?.id))) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (dbEnabled) {
    // Build insert payload — omit zone_id if the column doesn't exist yet (graceful)
    const payload = {
      room_id,
      catalog_id: catalog_id || null,
      name,
      category,
      provider,
      provider_id,
      width,
      depth,
      height,
      x_inches: x_inches || 0,
      y_inches: y_inches || 0,
      rotation: rotation || 0,
      color: color || '#d4a27a',
      custom: custom || false,
      image_url: image_url || null,
      model_url: model_url || null,
    };
    if (zone_id) payload.zone_id = zone_id;
    let { data, error } = await supabaseAdmin.from('placements').insert(payload).select().single();
    // Retry without optional columns missing on older deployments
    if (error && payload.zone_id && /zone_id/i.test(error.message || '')) {
      delete payload.zone_id;
      ({ data, error } = await supabaseAdmin.from('placements').insert(payload).select().single());
    }
    if (error && payload.image_url && /image_url/i.test(error.message || '')) {
      delete payload.image_url;
      ({ data, error } = await supabaseAdmin.from('placements').insert(payload).select().single());
    }
    if (error) return res.status(400).json({ error: error.message });
    return res.json({
      ...data,
      image_url: data.image_url ?? image_url ?? null,
      model_url: data.model_url ?? model_url ?? null,
    });
  }
  // Fallback
  const placement = fallback.addPlacement({ room_id, catalog_id, name, category, provider, provider_id, width, depth, height, x_inches, y_inches, rotation, color, custom, zone_id, image_url, model_url });
  res.json(placement);
});

// PUT /api/furniture/placements/:id
router.put('/placements/:id', optionalAuth, async (req, res) => {
  const allowed = ['x_inches', 'y_inches', 'rotation', 'width', 'depth', 'height', 'color', 'name', 'zone_id', 'model_url', 'image_url'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    // Verify ownership: placement must belong to a room owned by this user
    const { data: placement } = await supabaseAdmin
      .from('placements')
      .select('id, room_id, rooms!inner(user_id)')
      .eq('id', req.params.id)
      .single();
    if (!placement || placement.rooms?.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Placement not found' });
    }
    updates.updated_at = new Date().toISOString();
    let { data, error } = await supabaseAdmin
      .from('placements')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    // Retry without optional columns missing on older deployments
    if (error && /zone_id/i.test(error.message || '') && 'zone_id' in updates) {
      const { zone_id, ...rest } = updates;
      ({ data, error } = await supabaseAdmin
        .from('placements')
        .update(rest)
        .eq('id', req.params.id)
        .select()
        .single());
    }
    if (error && /image_url/i.test(error.message || '') && 'image_url' in updates) {
      const { image_url, ...rest } = updates;
      ({ data, error } = await supabaseAdmin
        .from('placements')
        .update(rest)
        .eq('id', req.params.id)
        .select()
        .single());
    }
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }
  const p = fallback.updatePlacement(req.params.id, updates);
  if (!p) return res.status(404).json({ error: 'Placement not found' });
  res.json(p);
});

// DELETE /api/furniture/placements/:id
router.delete('/placements/:id', optionalAuth, async (req, res) => {
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    // Verify ownership before deleting
    const { data: placement } = await supabaseAdmin
      .from('placements')
      .select('id, room_id, rooms!inner(user_id)')
      .eq('id', req.params.id)
      .single();
    if (!placement || placement.rooms?.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Placement not found' });
    }
    const { error } = await supabaseAdmin.from('placements').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  }
  fallback.deletePlacement(req.params.id);
  res.json({ success: true });
});

export default router;
