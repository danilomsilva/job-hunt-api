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
import { rateLimit } from './middleware/rate-limit.js';
import { authRoutes } from './routes/auth.js';
import { applicationsRoutes } from './routes/applications.js';
import { env } from './env.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', requestId());
  app.use('*', logger());

  // Skipped in tests: the default keyGenerator reads a real Node socket via
  // getConnInfo, which doesn't exist under app.request()'s test dispatch —
  // every test would share one bucket on the app singleton and trip 429s
  // partway through the suite.
  if (env.NODE_ENV !== 'test') {
    app.use('/auth/*', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
    app.use('*', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
  }

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
