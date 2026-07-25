-- Phase 6's Environment page needs the *full* environment.properties set,
-- not just the allowlisted fields EnvironmentInfo exposes (os/java/
-- platform/browser/framework/branch/build/machine - see
-- processor/normalize.ts's buildEnvironmentInfo). raw.environment already
-- has everything (parsePropertiesFile parses the whole file), it just never
-- got persisted anywhere beyond the narrow typed view.
alter table public.dashboard_data add column if not exists raw_environment jsonb not null default '{}'::jsonb;
