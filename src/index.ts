import './load-env.js';

import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './env.js';

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 job-hunt-api listening on http://localhost:${String(info.port)}`);
});
