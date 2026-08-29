/**
 * Builds the Hono application: middleware, routes, and the error handlers.
 *
 * `createApp()` returns a fresh instance so tests can run in isolation.
 * `app` is the singleton used by the server entry point.
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { treeifyError } from 'zod';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { rateLimit } from './middleware/rate-limit.js';
import { authRoutes } from './routes/auth.js';
import { applicationsRoutes } from './routes/applications.js';
import { ValidationError } from './lib/errors.js';
import { env } from './env.js';

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono({
    // Without this, a createRoute schema failure returns zod-openapi's own
    // response shape instead of this API's consistent { error, requestId }
    // one. Throwing here routes it through the same errorHandler as every
    // other error in the app.
    defaultHook: (result) => {
      if (!result.success) {
        throw new ValidationError(
          'The request payload failed validation',
          treeifyError(result.error),
        );
      }
    },
  });

  app.use('*', requestId());
  app.use('*', logger());

  // job-hunt-ui's Vite dev server — a different origin, so the browser (not
  // curl, not Swagger's server-side fetch) enforces CORS on every request.
  app.use(
    '*',
    cors({
      origin: 'http://localhost:5173',
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  );

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

  // Lets Swagger UI show an "Authorize" button for the protected
  // /applications routes, which declare `security: [{ Bearer: [] }]`.
  app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  app.doc('/doc', { openapi: '3.0.0', info: { title: 'job-hunt-api', version: '0.1.0' } });
  app.get('/ui', swaggerUI({ url: '/doc' }));

  app.route('/auth', authRoutes);
  app.route('/applications', applicationsRoutes);

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}

export const app = createApp();
