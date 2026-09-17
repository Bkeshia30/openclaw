-- 0004 — the booking transaction.
--
-- This lives in the database rather than in TypeScript for three reasons:
--   1. Atomicity. Contact upsert + appointment insert + event emit either all
--      happen or none do. A failed booking cannot leave an orphan contact behind.
--   2. The price, duration and buffers are READ FROM THE DATABASE. A caller who
--      posts {"price_cents": 1} is ignored, because the caller's price is never
--      consulted at all.
--   3. The exclusion constraint on `appointments` does the conflict detection, so
--      there is no check-then-insert window for two customers to race through.

create or replace function book_appointment(
  p_tenant_slug  text,
  p_service_id   uuid,
  p_staff_id     uuid,
  p_starts_at    timestamptz,
  p_first_name   text,
  p_last_name    text,
  p_email        citext,
  p_phone        text,
  p_note         text default null,
  p_consent_sms   boolean default false,
  p_consent_email boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant     tenants%rowtype;
  v_service    services%rowtype;
  v_contact_id uuid;
  v_ends       timestamptz;
  v_blocked_start timestamptz;
  v_blocked_end   timestamptz;
  v_appt_id    uuid;
begin
  if p_email is null and p_phone is null then
    raise exception 'a contact must have an email or a phone' using errcode = '22023';
  end if;

  select * into v_tenant from tenants where slug = p_tenant_slug;
  if not found then
    raise exception 'unknown tenant' using errcode = '22023';
  end if;

  -- Scoped by tenant: passing another tenant's service id finds nothing.
  select * into v_service
    from services
   where id = p_service_id and tenant_id = v_tenant.id and active;
  if not found then
    raise exception 'unknown or inactive service' using errcode = '22023';
  end if;

  if not exists (
    select 1 from staff s
      join staff_services ss on ss.staff_id = s.id
     where s.id = p_staff_id and s.tenant_id = v_tenant.id and s.active
       and ss.service_id = v_service.id
  ) then
    raise exception 'that stylist does not offer this service' using errcode = '22023';
  end if;

  if p_starts_at <= now() then
    raise exception 'cannot book a time in the past' using errcode = '22023';
  end if;

  -- Derived here, never accepted from the caller.
  v_ends          := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_blocked_start := p_starts_at - make_interval(mins => v_service.buffer_before_minutes);
  v_blocked_end   := v_ends      + make_interval(mins => v_service.buffer_after_minutes);

  -- Identity resolution, in priority order:
  --   1. same email  -> definitely the same person, reuse
  --   2. no email given, same phone -> probably the same person, reuse the most recent
  --   3. otherwise   -> a new person, even if the phone matches someone else
  -- Giving email priority is what lets a daughter book from her mother's phone
  -- and get her own record instead of being merged into her mother's history.
  loop
    if p_email is not null then
      select id into v_contact_id
        from contacts where tenant_id = v_tenant.id and email = p_email limit 1;
    else
      select id into v_contact_id
        from contacts where tenant_id = v_tenant.id and phone = p_phone
        order by coalesce(last_seen_at, created_at) desc limit 1;
    end if;

    if v_contact_id is not null then
      -- Fill in blanks only. Never overwrite what the salon already knows about
      -- someone because of what was typed into a public form.
      update contacts
         set last_seen_at   = now(),
             first_name     = coalesce(first_name, p_first_name),
             last_name      = coalesce(last_name,  p_last_name),
             phone          = coalesce(phone,      p_phone),
             consent_sms    = consent_sms   or p_consent_sms,
             consent_email  = consent_email or p_consent_email,
             consent_at     = coalesce(consent_at,
                                case when p_consent_sms or p_consent_email then now() end)
       where id = v_contact_id;
      exit;
    end if;

    begin
      insert into contacts (tenant_id, first_name, last_name, email, phone,
                            consent_sms, consent_email, consent_at, last_seen_at, source)
      values (v_tenant.id, p_first_name, p_last_name, p_email, p_phone,
              p_consent_sms, p_consent_email,
              case when p_consent_sms or p_consent_email then now() end, now(), 'booking')
      returning id into v_contact_id;
      exit;
    exception when unique_violation then
      -- Someone inserted this same person between our SELECT and our INSERT.
      -- Loop around and read their row instead of failing the booking.
      v_contact_id := null;
    end;
  end loop;

  -- If the slot is gone, this raises SQLSTATE 23P01 and the whole function rolls
  -- back — including the contact upsert above. The application maps 23P01 to
  -- "that time was just taken". That is the entire concurrency strategy.
  insert into appointments (
    tenant_id, contact_id, staff_id, service_id,
    starts_at, ends_at, blocked_starts_at, blocked_ends_at,
    status, price_cents, deposit_due_cents, customer_note
  ) values (
    v_tenant.id, v_contact_id, p_staff_id, v_service.id,
    p_starts_at, v_ends, v_blocked_start, v_blocked_end,
    'pending', v_service.price_cents, v_service.deposit_cents, p_note
  )
  returning id into v_appt_id;

  insert into events (tenant_id, type, contact_id, subject_type, subject_id, payload, dedupe_key)
  values (v_tenant.id, 'appointment.created', v_contact_id, 'appointment', v_appt_id,
          jsonb_build_object(
            'service_id', v_service.id, 'staff_id', p_staff_id,
            'starts_at', p_starts_at, 'price_cents', v_service.price_cents,
            'deposit_due_cents', v_service.deposit_cents),
          'appointment.created:' || v_appt_id::text);

  return v_appt_id;
end;
$$;

revoke all on function book_appointment(text, uuid, uuid, timestamptz, text, text, citext, text, text, boolean, boolean) from public;
grant execute on function book_appointment(text, uuid, uuid, timestamptz, text, text, citext, text, text, boolean, boolean) to anon, authenticated;

-- Cancelling frees the slot: the exclusion constraint is partial on status, so a
-- cancelled row stops participating in it entirely.
create or replace function cancel_appointment(p_appointment_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker            -- runs as the caller, so RLS still applies
set search_path = public, pg_temp
as $$
declare v_appt appointments%rowtype;
begin
  update appointments
     set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
   where id = p_appointment_id and status in ('pending','confirmed')
  returning * into v_appt;

  if not found then
    raise exception 'appointment not found or not cancellable' using errcode = '22023';
  end if;

  insert into events (tenant_id, type, contact_id, subject_type, subject_id, payload, dedupe_key)
  values (v_appt.tenant_id, 'appointment.cancelled', v_appt.contact_id, 'appointment', v_appt.id,
          jsonb_build_object('reason', p_reason),
          'appointment.cancelled:' || v_appt.id::text);
end;
$$;
