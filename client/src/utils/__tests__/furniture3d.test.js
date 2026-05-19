import { describe, expect, it } from 'vitest';
import { STARTER_FURNITURE_CATALOG } from '@/data/furnitureCatalog';
import {
  furnitureDimensionsToMeters,
  getFurnitureRenderDimensionsInches,
  getFurnitureRenderDimensionsMeters,
  resolveFurnitureModelUrl,
  resolveProceduralCategory,
  shouldUseGlbModel,
  STARTER_CATEGORY_TO_PROCEDURAL,
} from '@/utils/furniture3d';

describe('furniture3d', () => {
  it('maps starter catalog categories to procedural types', () => {
    expect(STARTER_CATEGORY_TO_PROCEDURAL.seating).toBe('sofa');
    expect(STARTER_CATEGORY_TO_PROCEDURAL.tables).toBe('coffee_table');
    expect(STARTER_CATEGORY_TO_PROCEDURAL.beds).toBe('bed');
    expect(STARTER_CATEGORY_TO_PROCEDURAL.storage).toBe('cabinet');
    expect(STARTER_CATEGORY_TO_PROCEDURAL.lighting).toBe('lamp');
    expect(STARTER_CATEGORY_TO_PROCEDURAL.decor).toBe('decor');
  });

  it('resolveProceduralCategory refines tables and seating by name', () => {
    expect(resolveProceduralCategory({ category: 'tables', name: 'Dining Table' })).toBe(
      'dining_table',
    );
    expect(resolveProceduralCategory({ category: 'seating', name: 'Armchair' })).toBe('armchair');
    expect(resolveProceduralCategory({ category: 'storage', name: 'Bookshelf' })).toBe(
      'bookshelf',
    );
  });

  it('resolveProceduralCategory passes through legacy API categories', () => {
    expect(resolveProceduralCategory({ category: 'sofa' })).toBe('sofa');
    expect(resolveProceduralCategory({ category: 'nightstand' })).toBe('nightstand');
  });

  it('resolveFurnitureModelUrl prefers model_url then modelUrl', () => {
    expect(resolveFurnitureModelUrl({ model_url: '/a.glb' })).toBe('/a.glb');
    expect(resolveFurnitureModelUrl({ modelUrl: '/b.glb' })).toBe('/b.glb');
    expect(resolveFurnitureModelUrl({ model_url: '', modelUrl: '/b.glb' })).toBe('/b.glb');
    expect(resolveFurnitureModelUrl({})).toBeNull();
    expect(resolveFurnitureModelUrl(null)).toBeNull();
  });

  it('shouldUseGlbModel reflects resolved URL', () => {
    expect(shouldUseGlbModel({ model_url: '/models/kenney/chair.glb' })).toBe(true);
    expect(shouldUseGlbModel(STARTER_FURNITURE_CATALOG[0])).toBe(false);
  });

  it('getFurnitureRenderDimensionsInches uses footprint and dimensions', () => {
    const item = STARTER_FURNITURE_CATALOG[0];
    expect(getFurnitureRenderDimensionsInches(item)).toEqual({
      width: item.footprint.width,
      depth: item.footprint.depth,
      height: item.dimensions.height,
    });
  });

  it('getFurnitureRenderDimensionsInches falls back when fields are missing', () => {
    expect(getFurnitureRenderDimensionsInches({})).toEqual({
      width: 24,
      depth: 24,
      height: 30,
    });
    expect(getFurnitureRenderDimensionsInches(null)).toEqual({
      width: 24,
      depth: 24,
      height: 30,
    });
  });

  it('furnitureDimensionsToMeters converts inches accurately', () => {
    const meters = furnitureDimensionsToMeters({ width: 48, depth: 24, height: 30 });
    expect(meters.w).toBeCloseTo(48 * 0.0254, 5);
    expect(meters.d).toBeCloseTo(24 * 0.0254, 5);
    expect(meters.h).toBeCloseTo(30 * 0.0254, 5);
  });

  it('getFurnitureRenderDimensionsMeters combines helpers', () => {
    const sofa = STARTER_FURNITURE_CATALOG[0];
    const m = getFurnitureRenderDimensionsMeters(sofa);
    expect(m.w).toBeGreaterThan(0);
    expect(m.d).toBeGreaterThan(0);
    expect(m.h).toBeGreaterThan(0);
  });
});
