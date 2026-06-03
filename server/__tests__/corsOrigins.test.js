import { describe, expect, it } from 'vitest';
import {
  LOCAL_DEV_ORIGINS,
  buildCorsConfig,
  isOriginAllowed,
  parseOriginList,
} from '../config/corsOrigins.js';

describe('corsOrigins', () => {
  it('parseOriginList splits comma-separated origins', () => {
    expect(parseOriginList('https://a.app, https://b.app')).toEqual([
      'https://a.app',
      'https://b.app',
    ]);
  });

  it('buildCorsConfig merges CLIENT_ORIGIN, CLIENT_ORIGINS, and ALLOWED_ORIGINS', () => {
    const config = buildCorsConfig({
      CLIENT_ORIGIN: 'https://prod.vercel.app',
      CLIENT_ORIGINS: 'https://preview-a.vercel.app',
      ALLOWED_ORIGINS: 'https://legacy.example.com',
      ALLOW_VERCEL_PREVIEWS: 'false',
    });
    expect(config.exactOrigins.has('https://prod.vercel.app')).toBe(true);
    expect(config.exactOrigins.has('https://preview-a.vercel.app')).toBe(true);
    expect(config.exactOrigins.has('https://legacy.example.com')).toBe(true);
    for (const origin of LOCAL_DEV_ORIGINS) {
      expect(config.exactOrigins.has(origin)).toBe(true);
    }
  });

  it('allows dynamic Vercel preview hosts when ALLOW_VERCEL_PREVIEWS=true', () => {
    const config = buildCorsConfig({ ALLOW_VERCEL_PREVIEWS: 'true' });
    expect(
      isOriginAllowed(
        'https://vision-studio-exl61l8ke-alaurosas-projects.vercel.app',
        config,
      ),
    ).toBe(true);
    expect(isOriginAllowed('https://evil.example.com', config)).toBe(false);
    expect(isOriginAllowed('https://notvercel.app.evil.com', config)).toBe(false);
  });

  it('does not allow Vercel previews when flag is off', () => {
    const config = buildCorsConfig({ ALLOW_VERCEL_PREVIEWS: 'false' });
    expect(
      isOriginAllowed(
        'https://vision-studio-exl61l8ke-alaurosas-projects.vercel.app',
        config,
      ),
    ).toBe(false);
  });
});
