import app from './app.js';
import { log } from './services/logger.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => log.info(`Vision Studio backend running on :${PORT}`));

// ---------- Graceful shutdown ----------
function shutdown(signal) {
  log.info(`Received ${signal} — shutting down gracefully…`);
  server.close(() => {
    log.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    log.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
