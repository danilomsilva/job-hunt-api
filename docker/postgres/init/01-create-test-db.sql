-- Runs automatically the first time the Postgres data volume is created.
-- The integration test suite connects to this separate database so it can be
-- migrated and truncated without touching development data.
CREATE DATABASE job_hunt_test;
