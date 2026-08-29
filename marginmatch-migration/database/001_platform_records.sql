-- Compatibility-first Postgres storage for MarginMatch.
-- Preserves AppDeploy collection names and schemaless record shapes during migration.

create extension if not exists pgcrypto;

create table if not exists platform_records (
  collection text not null,
  id uuid not null default gen_random_uuid(),
  record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists platform_records_collection_idx
  on platform_records (collection);

create index if not exists platform_records_record_gin_idx
  on platform_records using gin (record);

create or replace function touch_platform_record_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_records_touch on platform_records;
create trigger platform_records_touch
before update on platform_records
for each row execute function touch_platform_record_updated_at();

-- Keep server-side access locked by default. The portable backend uses a
-- service credential; browser clients must not directly mutate this table.
alter table platform_records enable row level security;
