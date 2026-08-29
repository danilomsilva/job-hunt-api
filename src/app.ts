/**
 * Builds the Hono application: middleware, routes, and the error handlers.
 *
 * `createApp()` returns a fresh instance so tests can run in isolation.
 * `app` is the singleton used by the server entry point.
 */
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { applicationsRoutes } from './routes/applications.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', requestId());
  app.use('*', logger());

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  app.route('/auth', authRoutes);
  app.route('/applications', applicationsRoutes);

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}

export const app = createApp();
