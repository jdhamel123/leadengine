create table if not exists migration_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  snapshot_exported_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  expected_collections integer not null default 0,
  expected_records integer not null default 0,
  imported_records integer not null default 0,
  notes text not null default ''
);
