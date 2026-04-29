/**
 * Structured logger for Vision Studio server.
 * Replaces raw console.log/warn/error with consistent, timestamped output.
 * In production, these can be piped to a log aggregator.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function format(level, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

export const log = {
  debug(message, meta) {
    if (MIN_LEVEL <= LEVELS.debug) console.debug(format('debug', message, meta));
  },
  info(message, meta) {
    if (MIN_LEVEL <= LEVELS.info) console.log(format('info', message, meta));
  },
  warn(message, meta) {
    if (MIN_LEVEL <= LEVELS.warn) console.warn(format('warn', message, meta));
  },
  error(message, meta) {
    if (MIN_LEVEL <= LEVELS.error) console.error(format('error', message, meta));
  },
};
