/**
 * E2E API smoke tests — run against the Express app in-process (no browser).
 * Works in fallback/demo mode without real Supabase credentials.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';

const TEST_TOKEN = 'vs-test-token-001';
const auth = (req) => req.set('Authorization', `Bearer ${TEST_TOKEN}`);

describe('E2E API smoke', () => {
  it('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/status responds within 5s', async () => {
    const start = Date.now();
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.tables).toBeDefined();
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('GET /api/furniture/catalog returns items', async () => {
    const res = await request(app).get('/api/furniture/catalog?limit=3');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('GET /api/furniture/categories', async () => {
    const res = await request(app).get('/api/furniture/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/rooms creates a fallback room for test user', async () => {
    const res = await auth(
      request(app).post('/api/rooms').send({
        name: 'E2E Test Room',
        width: 240,
        depth: 180,
        unit: 'inches',
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('E2E Test Room');
  });

  it('full placement flow: create room → add → update → delete', async () => {
    const roomRes = await auth(
      request(app).post('/api/rooms').send({ name: 'E2E Placement Room', width: 200, depth: 160 }),
    );
    expect(roomRes.status).toBe(200);
    const roomId = roomRes.body.id;

    const catalogRes = await request(app).get('/api/furniture/catalog?limit=1');
    const catalogItem = catalogRes.body.items[0];

    const addRes = await auth(
      request(app).post('/api/furniture/placements').send({
        room_id: roomId,
        catalog_id: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        provider: catalogItem.provider,
        width: catalogItem.width,
        depth: catalogItem.depth,
        height: catalogItem.height,
        x_inches: 24,
        y_inches: 24,
        rotation: 0,
        image_url: catalogItem.image_url,
        model_url: catalogItem.model_url,
      }),
    );
    expect(addRes.status).toBe(200);
    expect(addRes.body.room_id).toBe(roomId);
    expect(addRes.body.image_url).toBe(catalogItem.image_url);
    const placementId = addRes.body.id;

    const updateRes = await auth(
      request(app).put(`/api/furniture/placements/${placementId}`).send({
        x_inches: 48,
        y_inches: 36,
        rotation: 90,
      }),
    );
    expect(updateRes.status).toBe(200);
    expect(Number(updateRes.body.x_inches)).toBe(48);

    const getRes = await auth(request(app).get(`/api/rooms/${roomId}`));
    expect(getRes.status).toBe(200);
    expect(getRes.body.placements).toHaveLength(1);
    expect(getRes.body.placements[0].image_url).toBe(catalogItem.image_url);

    const delRes = await auth(request(app).delete(`/api/furniture/placements/${placementId}`));
    expect(delRes.status).toBe(200);

    await auth(request(app).delete(`/api/rooms/${roomId}`));
  });

  it('POST /api/furniture/placements rejects unknown room', async () => {
    const res = await auth(
      request(app).post('/api/furniture/placements').send({
        room_id: '00000000-0000-4000-8000-000000000099',
        name: 'Ghost Sofa',
        category: 'sofa',
        width: 84,
        depth: 36,
        x_inches: 0,
        y_inches: 0,
      }),
    );
    expect(res.status).toBe(404);
  });

  it('POST /api/layout/auto-place accepts draft room with placements_context', async () => {
    const catalogRes = await request(app).get('/api/furniture/catalog?limit=1');
    const item = catalogRes.body.items[0];
    const placementId = 'e2e-draft-placement-1';

    const res = await auth(
      request(app).post('/api/layout/auto-place').send({
        room_id: 'draft-e2e-auto',
        room_context: { width: 240, depth: 180, name: 'Draft Auto' },
        placements_context: [
          {
            id: placementId,
            name: item.name,
            category: item.category,
            width: item.width,
            depth: item.depth,
            height: item.height,
            x_inches: 12,
            y_inches: 12,
            rotation: 0,
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.placements)).toBe(true);
    expect(res.body.placements.some((p) => p.id === placementId)).toBe(true);
  });

  it('POST /api/layout/generate — bedroom constraint layout', async () => {
    const res = await request(app).post('/api/layout/generate').send({
      room_type: 'bedroom',
      room: { width: 144, depth: 132 },
      use_catalog: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.method).toBe('constraint_layout_v1');
    expect(res.body.validation.valid).toBe(true);
    expect(res.body.placements.some((p) => p.category === 'bed')).toBe(true);
  });

  it('POST /api/layout/generate — living room constraint layout', async () => {
    const res = await request(app).post('/api/layout/generate').send({
      room_type: 'living_room',
      room: { width: 216, depth: 168 },
      use_catalog: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.validation.valid).toBe(true);
    expect(res.body.placements.some((p) => p.category === 'sofa')).toBe(true);
    expect(res.body.placements.some((p) => p.category === 'tv_stand')).toBe(true);
  });

  it('POST /api/layout/validate accepts draft room_context', async () => {
    const res = await auth(
      request(app).post('/api/layout/validate').send({
        room_id: 'draft-e2e-test',
        room_context: { width: 240, depth: 180, name: 'Draft' },
        placements_context: [],
      }),
    );
    expect(res.status).toBe(200);
    expect(typeof res.body.valid).toBe('boolean');
  });

  it('rejects invalid Bearer token instead of treating as guest', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', 'Bearer not-a-valid-token');
    expect(res.status).toBe(401);
  });

  it('GET /api/projects returns array for test user', async () => {
    const res = await auth(request(app).get('/api/projects'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/projects creates a project', async () => {
    const res = await auth(
      request(app).post('/api/projects').send({
        name: 'E2E Project',
        property_type: 'House',
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('E2E Project');
    expect(Array.isArray(res.body.spaces)).toBe(true);
  });
});
