import { log } from '../services/logger.js';

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log server errors with full stack, client errors at warn level
  if (status >= 500) {
    log.error(`${req.method} ${req.path} → ${status}: ${message}`, {
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    });
  } else {
    log.warn(`${req.method} ${req.path} → ${status}: ${message}`);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
