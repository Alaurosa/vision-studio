/**
 * S2-5 save/load persistence smoke test.
 *
 * Exercises the routes that the editor's "Save Project" button hits and the
 * routes the dashboard hits after sign-in. Uses a real Supabase test user
 * (created at setup, deleted at teardown) so RLS, auth, and table writes are
 * all verified end-to-end.
 *
 * Skips itself if the required Supabase env vars aren't present, so CI / local
 * runs without credentials don't false-fail.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

import app from '../app.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLIC_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const haveCreds = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_ANON_KEY;
const d = haveCreds ? describe : describe.skip;

d('save/load persistence (S2-5)', () => {
  const admin = haveCreds ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
  const publicClient = haveCreds ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  const email = `save-load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@vision-studio.test`;
  const password = 'TestPassw0rd!';

  let userId = null;
  let accessToken = null;

  // Test artifacts — declared in outer scope so cleanup can see them.
  let roomId = null;
  let placementId = null;

  beforeAll(async () => {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
    userId = created.user.id;

    const { data: signin, error: signinErr } = await publicClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signinErr) throw new Error(`signIn failed: ${signinErr.message}`);
    accessToken = signin.session.access_token;
  });

  afterAll(async () => {
    if (!admin) return;
    // Best-effort cleanup. Room rows cascade via FK on the user delete.
    if (roomId) {
      await admin.from('placements').delete().eq('room_id', roomId);
      await admin.from('rooms').delete().eq('id', roomId);
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  const auth = (req) => req.set('Authorization', `Bearer ${accessToken}`);

  // ---------- SAVE ----------

  it('creates a room (POST /api/rooms)', async () => {
    const res = await auth(
      request(app).post('/api/rooms').send({
        name: 'Save/Load Smoke Test Room',
        unit: 'inches',
        width: 240,
        depth: 180,
      })
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.user_id).toBe(userId);
    expect(res.body.name).toBe('Save/Load Smoke Test Room');
    roomId = res.body.id;
  });

  it('saves dimensions, walls, scale, and zones (PUT /api/rooms/:id)', async () => {
    const zones = [
      {
        id: 'zone-living',
        name: 'Living',
        polygon: [[0, 0], [120, 0], [120, 96], [0, 96]],
        bbox: [0, 0, 120, 96],
        width: 120,
        depth: 96,
        color: '#9c6a3f',
      },
      {
        id: 'zone-kitchen',
        name: 'Kitchen',
        polygon: [[120, 0], [240, 0], [240, 96], [120, 96]],
        bbox: [120, 0, 240, 96],
        width: 120,
        depth: 96,
        color: '#3f7a9c',
      },
    ];
    const walls = [[0, 0], [240, 0], [240, 180], [0, 180]];

    const res = await auth(
      request(app).put(`/api/rooms/${roomId}`).send({
        name: 'Updated Room Name',
        width: 300,
        depth: 200,
        height: 100,
        zones,
        walls,
        scale_px_per_inch: 2.5,
      })
    );

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Room Name');
    expect(Number(res.body.width)).toBe(300);
    expect(Number(res.body.depth)).toBe(200);
    expect(Number(res.body.scale_px_per_inch)).toBe(2.5);
    expect(Array.isArray(res.body.zones)).toBe(true);
    expect(res.body.zones).toHaveLength(2);
  });

  it('reloads the room with all saved metadata (GET /api/rooms/:id)', async () => {
    const res = await auth(request(app).get(`/api/rooms/${roomId}`));
    expect(res.status).toBe(200);
    expect(Number(res.body.width)).toBe(300);
    expect(Number(res.body.depth)).toBe(200);
    expect(Number(res.body.height)).toBe(100);
    expect(res.body.zones).toHaveLength(2);
    expect(res.body.zones[0].name).toBe('Living');
    expect(res.body.zones[1].name).toBe('Kitchen');
    expect(res.body.placements).toEqual([]);
  });

  it('adds a furniture placement (POST /api/furniture/placements)', async () => {
    const res = await auth(
      request(app).post('/api/furniture/placements').send({
        room_id: roomId,
        name: 'Test Sofa',
        category: 'sofa',
        provider: 'custom',
        width: 84,
        depth: 36,
        height: 32,
        x_inches: 24,
        y_inches: 24,
        rotation: 0,
        color: '#a3733e',
        zone_id: 'zone-living',
      })
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.room_id).toBe(roomId);
    expect(res.body.name).toBe('Test Sofa');
    expect(Number(res.body.x_inches)).toBe(24);
    placementId = res.body.id;
  });

  it('updates placement position, rotation, color (PUT /api/furniture/placements/:id)', async () => {
    const res = await auth(
      request(app).put(`/api/furniture/placements/${placementId}`).send({
        x_inches: 60,
        y_inches: 48,
        rotation: 90,
        color: '#3f6a9c',
      })
    );
    expect(res.status).toBe(200);
    expect(Number(res.body.x_inches)).toBe(60);
    expect(Number(res.body.y_inches)).toBe(48);
    expect(res.body.rotation).toBe(90);
    expect(res.body.color).toBe('#3f6a9c');
  });

  // ---------- LOAD (post-login) ----------

  it('lists the room for the user (GET /api/rooms)', async () => {
    const res = await auth(request(app).get('/api/rooms'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((r) => r.id === roomId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Updated Room Name');
    // Embedded placements come back via the join on /api/rooms
    expect(Array.isArray(found.placements)).toBe(true);
    expect(found.placements.length).toBe(1);
  });

  it('returns furniture in the saved position on reload (GET /api/rooms/:id)', async () => {
    const res = await auth(request(app).get(`/api/rooms/${roomId}`));
    expect(res.status).toBe(200);
    expect(res.body.placements).toHaveLength(1);
    const p = res.body.placements[0];
    expect(p.id).toBe(placementId);
    expect(Number(p.x_inches)).toBe(60);
    expect(Number(p.y_inches)).toBe(48);
    expect(p.rotation).toBe(90);
    expect(p.color).toBe('#3f6a9c');
  });

  // ---------- AUTH ISOLATION ----------

  it("does not return this user's room to a guest (no Authorization header)", async () => {
    const res = await request(app).get('/api/rooms');
    expect(res.status).toBe(200);
    // Guest goes through fallbackStore; the saved room is in Supabase only.
    const leaked = (Array.isArray(res.body) ? res.body : []).find((r) => r.id === roomId);
    expect(leaked).toBeUndefined();
  });

  it('rejects access to the room with an invalid bearer token', async () => {
    const res = await request(app)
      .get(`/api/rooms/${roomId}`)
      .set('Authorization', 'Bearer not-a-real-token');
    // optionalAuth falls through to guest, then the room query filters by guest user_id → 404
    expect([401, 404]).toContain(res.status);
  });

  // ---------- DELETE ----------

  it('deletes a placement (DELETE /api/furniture/placements/:id)', async () => {
    const res = await auth(request(app).delete(`/api/furniture/placements/${placementId}`));
    expect(res.status).toBe(200);
    placementId = null; // cleanup hook will skip if already gone

    const reload = await auth(request(app).get(`/api/rooms/${roomId}`));
    expect(reload.body.placements).toEqual([]);
  });

  it('deletes a room (DELETE /api/rooms/:id)', async () => {
    const res = await auth(request(app).delete(`/api/rooms/${roomId}`));
    expect(res.status).toBe(200);
    const savedId = roomId;
    roomId = null; // cleanup hook will skip if already gone

    const reload = await auth(request(app).get(`/api/rooms/${savedId}`));
    expect(reload.status).toBe(404);
  });
});
