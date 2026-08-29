-- Atomic first-accept-wins protection for contractor dispatch offers.
-- PostgreSQL advisory locks serialize competing accepts for the same orderRef.

create or replace function claim_dispatch_offer(p_collection text, p_offer_id uuid, p_order_ref text)
returns table(won boolean, reason text)
language plpgsql
as $$
declare
  current_record jsonb;
  sibling record;
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(p_order_ref,'')));

  select record into current_record
  from platform_records
  where collection=p_collection and id=p_offer_id
  for update;

  if current_record is null then
    return query select false, 'offer-not-found';
    return;
  end if;

  if coalesce(current_record->>'status','') not in ('offered','text-sent') then
    return query select false, 'offer-not-open';
    return;
  end if;

  if exists (
    select 1 from platform_records
    where collection=p_collection
      and id<>p_offer_id
      and record->>'orderRef'=p_order_ref
      and record->>'status'='accepted'
  ) then
    return query select false, 'already-accepted';
    return;
  end if;

  update platform_records
  set record = current_record
    || jsonb_build_object('status','accepted','acceptedAt',to_jsonb(now()::text)),
      updated_at=now()
  where collection=p_collection and id=p_offer_id;

  for sibling in
    select id,record from platform_records
    where collection=p_collection
      and id<>p_offer_id
      and record->>'orderRef'=p_order_ref
      and record->>'status'='offered'
    for update
  loop
    update platform_records
    set record=sibling.record||jsonb_build_object('status','superseded','supersededAt',to_jsonb(now()::text)),
        updated_at=now()
    where collection=p_collection and id=sibling.id;
  end loop;

  return query select true, 'accepted';
end;
$$;
