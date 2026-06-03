/**
 * CORS origin allowlist for Express (credentials enabled — no wildcard "*").
 */

/** Always allowed in development and production. */
export const LOCAL_DEV_ORIGINS = Object.freeze([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
]);

const VERCEL_PREVIEW_HOST_SUFFIX = '.vercel.app';

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseOriginList(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ exactOrigins: Set<string>, allowVercelPreviews: boolean }}
 */
export function buildCorsConfig(env = process.env) {
  const exactOrigins = new Set(LOCAL_DEV_ORIGINS);

  for (const key of ['CLIENT_ORIGIN', 'CLIENT_ORIGINS', 'ALLOWED_ORIGINS']) {
    const value = env[key];
    if (key === 'CLIENT_ORIGIN' && value?.trim()) {
      exactOrigins.add(value.trim());
    } else {
      for (const origin of parseOriginList(value)) {
        exactOrigins.add(origin);
      }
    }
  }

  const allowVercelPreviews =
    String(env.ALLOW_VERCEL_PREVIEWS || '').toLowerCase() === 'true';

  return { exactOrigins, allowVercelPreviews };
}

/**
 * @param {string} origin
 * @param {{ exactOrigins: Set<string>, allowVercelPreviews: boolean }} config
 * @returns {boolean}
 */
export function isOriginAllowed(origin, config) {
  if (!origin || typeof origin !== 'string') return false;
  if (config.exactOrigins.has(origin)) return true;
  if (!config.allowVercelPreviews) return false;

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return (
      hostname === VERCEL_PREVIEW_HOST_SUFFIX.slice(1) ||
      hostname.endsWith(VERCEL_PREVIEW_HOST_SUFFIX)
    );
  } catch {
    return false;
  }
}

/**
 * Express/cors-compatible origin callback.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ warn?: (msg: string) => void }} [options]
 * @returns {(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void}
 */
export function createCorsOriginValidator(env = process.env, options = {}) {
  const config = buildCorsConfig(env);
  const shouldLogBlocked = env.NODE_ENV !== 'production';
  const warn = options.warn ?? (() => {});

  return function corsOrigin(origin, callback) {
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin, config)) return callback(null, true);
    if (shouldLogBlocked) {
      warn(`CORS blocked origin: ${origin}`);
    }
    callback(new Error('Not allowed by CORS'));
  };
}
