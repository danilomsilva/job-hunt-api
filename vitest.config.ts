import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/job_hunt_test',
      JWT_SECRET: 'test-secret-do-not-use-in-production-min-32-chars',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL_DAYS: '30',
    },
    setupFiles: ['./src/test/setup.ts'],
    // setup.ts truncates shared tables in a real Postgres instance after every
    // test — running files in parallel lets one file's cleanup race another
    // file's in-progress inserts against that same database.
    fileParallelism: false,
  },
});
