-- Supabase proof-photo bucket for the portable Mattress Rescue driver workflow.
-- Run after the primary platform_records migration.

insert into storage.buckets (id, name, public)
values ('marginmatch-proof', 'marginmatch-proof', false)
on conflict (id) do update set public = excluded.public;

-- No public object policy is created.
-- The portable backend writes with a service credential and never exposes the
-- service key to the browser.
