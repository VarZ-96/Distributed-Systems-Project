import 'dotenv/config';
import { createApp } from './app.js';
import { createContainer } from './container.js';

async function bootstrap() {
  const container = createContainer(process.env);
  const { config, database, databaseInitializer } = container;

  console.log('[Server] Initializing PostgreSQL schema & RBAC seed...');
  await databaseInitializer.initialize();
  console.log('[Server] PostgreSQL schema & RBAC seed ready.');

  const app = createApp(container);

  const server = app.listen(config.port, () => {
    console.log(`[Server] Listening on http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(`[Server] Allowed CORS origin: ${config.frontendUrl}`);
  });

  // Graceful shutdown for clean container/process termination
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await database.close();
        console.log('[Server] PostgreSQL pool closed. Goodbye.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error closing PostgreSQL pool:', err.message);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('[Server] Fatal startup error:', error.message);
  process.exit(1);
});
