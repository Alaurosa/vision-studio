import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { useDb, supabaseAdmin, fallback } from '../services/db.js';

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hasDbUserId = (userId) => typeof userId === 'string' && UUID_RE.test(userId);

async function createCompatRoom({ userId, name, width = 240, depth = 180, unit = 'inches' }, dbEnabled) {
  if (dbEnabled) {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .insert({
        user_id: userId,
        name: name || 'Space',
        unit,
        width,
        depth,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  return fallback.createRoom(userId, { name, unit, width, depth });
}

// GET /api/projects
router.get('/', optionalAuth, async (req, res) => {
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    const projectIds = (projects || []).map((p) => p.id);
    const { data: spaces } = projectIds.length
      ? await supabaseAdmin.from('spaces').select('*').in('project_id', projectIds).order('created_at', { ascending: true })
      : { data: [] };
    const grouped = new Map();
    (spaces || []).forEach((s) => {
      if (!grouped.has(s.project_id)) grouped.set(s.project_id, []);
      grouped.get(s.project_id).push(s);
    });
    return res.json((projects || []).map((p) => ({ ...p, spaces: grouped.get(p.id) || [] })));
  }
  return res.json(fallback.getProjects(req.user.id));
});

// POST /api/projects
router.post('/', optionalAuth, async (req, res) => {
  const {
    name,
    property_type = 'House',
    scope = 'interior_exterior',
    global_vision = {},
    status = 'in_progress',
  } = req.body || {};
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: req.user.id,
        name: name || 'Untitled Project',
        property_type,
        scope,
        global_vision,
        status,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ...data, spaces: [] });
  }
  return res.json(fallback.createProject(req.user.id, { name, property_type, scope, global_vision, status }));
});

// GET /api/projects/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    if (error) return res.status(404).json({ error: 'Project not found' });
    const { data: spaces } = await supabaseAdmin
      .from('spaces')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });
    return res.json({ ...project, spaces: spaces || [] });
  }
  const project = fallback.getProject(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  return res.json(project);
});

// PUT /api/projects/:id
router.put('/:id', optionalAuth, async (req, res) => {
  const { name, property_type, scope, global_vision, status } = req.body || {};
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (property_type !== undefined) updates.property_type = property_type;
  if (scope !== undefined) updates.scope = scope;
  if (global_vision !== undefined) updates.global_vision = global_vision;
  if (status !== undefined) updates.status = status;
  updates.updated_at = new Date().toISOString();
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }
  const project = fallback.updateProject(req.params.id, req.user.id, updates);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  return res.json(project);
});

// DELETE /api/projects/:id
router.delete('/:id', optionalAuth, async (req, res) => {
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { error } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  }
  fallback.deleteProject(req.params.id, req.user.id);
  return res.json({ success: true });
});

// POST /api/projects/:projectId/spaces
router.post('/:projectId/spaces', optionalAuth, async (req, res) => {
  const {
    room_id,
    type = 'interior',
    name = type === 'exterior' ? 'Exterior Area' : 'Interior Space',
    category = type === 'exterior' ? 'Exterior Area' : 'Interior Space',
    space_vision = {},
    placeholder_mode = type === 'exterior',
    room_payload = {},
  } = req.body || {};

  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  let compatRoomId = room_id || null;
  try {
    if (!compatRoomId) {
      const room = await createCompatRoom(
        {
          userId: req.user.id,
          name: room_payload.name || `${name} Room`,
          width: room_payload.width || (type === 'exterior' ? 300 : 240),
          depth: room_payload.depth || (type === 'exterior' ? 220 : 180),
          unit: room_payload.unit || 'inches',
        },
        dbEnabled
      );
      compatRoomId = room.id;
    }
  } catch (err) {
    return res.status(400).json({ error: `Failed to create room linkage: ${err.message}` });
  }

  if (dbEnabled) {
    const { data: project, error: pErr } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', req.params.projectId)
      .eq('user_id', req.user.id)
      .single();
    if (pErr || !project) return res.status(404).json({ error: 'Project not found' });
    const { data, error } = await supabaseAdmin
      .from('spaces')
      .insert({
        project_id: req.params.projectId,
        room_id: compatRoomId,
        type,
        name,
        category,
        space_vision,
        placeholder_mode,
      })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }
  const space = fallback.createSpace(req.params.projectId, req.user.id, {
    room_id: compatRoomId,
    type,
    name,
    category,
    space_vision,
    placeholder_mode,
  });
  if (!space) return res.status(404).json({ error: 'Project not found' });
  return res.json(space);
});

// PUT /api/projects/:projectId/spaces/:spaceId
router.put('/:projectId/spaces/:spaceId', optionalAuth, async (req, res) => {
  const { type, name, category, room_id, space_vision, placeholder_mode } = req.body || {};
  const updates = {};
  if (type !== undefined) updates.type = type;
  if (name !== undefined) updates.name = name;
  if (category !== undefined) updates.category = category;
  if (room_id !== undefined) updates.room_id = room_id;
  if (space_vision !== undefined) updates.space_vision = space_vision;
  if (placeholder_mode !== undefined) updates.placeholder_mode = placeholder_mode;
  updates.updated_at = new Date().toISOString();
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data: project, error: pErr } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', req.params.projectId)
      .eq('user_id', req.user.id)
      .single();
    if (pErr || !project) return res.status(404).json({ error: 'Project not found' });
    const { data, error } = await supabaseAdmin
      .from('spaces')
      .update(updates)
      .eq('id', req.params.spaceId)
      .eq('project_id', req.params.projectId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  }
  const space = fallback.updateSpace(req.params.projectId, req.params.spaceId, req.user.id, updates);
  if (!space) return res.status(404).json({ error: 'Space not found' });
  return res.json(space);
});

// DELETE /api/projects/:projectId/spaces/:spaceId
router.delete('/:projectId/spaces/:spaceId', optionalAuth, async (req, res) => {
  const dbEnabled = (await useDb()) && hasDbUserId(req.user?.id);
  if (dbEnabled) {
    const { data: project, error: pErr } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', req.params.projectId)
      .eq('user_id', req.user.id)
      .single();
    if (pErr || !project) return res.status(404).json({ error: 'Project not found' });
    const { error } = await supabaseAdmin
      .from('spaces')
      .delete()
      .eq('id', req.params.spaceId)
      .eq('project_id', req.params.projectId);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  }
  const ok = fallback.deleteSpace(req.params.projectId, req.params.spaceId, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Space not found' });
  return res.json({ success: true });
});

export default router;
