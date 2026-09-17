-- ============================================================================
-- SETUP — run this ONCE, after the migrations, and after you have signed in
-- at /login one time (signing in is what creates your user record).
--
-- Change the five values in the first block. Change nothing else.
-- Then paste the whole file into the Supabase SQL editor and press Run.
-- ============================================================================

do $$
declare
  -- ---------- CHANGE THESE FIVE ----------
  my_email      text := 'you@example.com';      -- the email you signed in with
  salon_name    text := 'Your Salon';           -- shown to clients
  salon_slug    text := 'yoursalon';            -- your booking link: /book/yoursalon
  your_name     text := 'Your Name';            -- the stylist name clients see
  salon_tz      text := 'America/New_York';     -- your timezone, IANA format
  -- ---------------------------------------

  v_user_id   uuid;
  v_tenant_id uuid;
  v_staff_id  uuid;
begin
  select id into v_user_id from auth.users where email = my_email;
  if v_user_id is null then
    raise exception
      'No user found for %. Sign in at /login with that email first, then run this again.', my_email;
  end if;

  -- Salon
  insert into tenants (name, slug, timezone)
  values (salon_name, salon_slug, salon_tz)
  on conflict (slug) do update set name = excluded.name, timezone = excluded.timezone
  returning id into v_tenant_id;

  -- Your login, bound to the salon as owner
  insert into profiles (id, tenant_id, role, full_name)
  values (v_user_id, v_tenant_id, 'owner', your_name)
  on conflict (id) do update set tenant_id = excluded.tenant_id, role = 'owner';

  -- You, as the stylist clients book
  select id into v_staff_id from staff where tenant_id = v_tenant_id and profile_id = v_user_id;
  if v_staff_id is null then
    insert into staff (tenant_id, profile_id, display_name)
    values (v_tenant_id, v_user_id, your_name)
    returning id into v_staff_id;
  end if;

  -- Starter hours: Tuesday to Saturday, 9am to 6pm.
  -- Change these on the Hours page once you are signed in — no SQL needed.
  if not exists (select 1 from availability_rules where staff_id = v_staff_id) then
    insert into availability_rules (tenant_id, staff_id, weekday, start_time, end_time)
    select v_tenant_id, v_staff_id, d, '09:00', '18:00'
    from unnest(array[2,3,4,5,6]) as d;
  end if;

  raise notice 'Done. Your booking page is /book/%', salon_slug;
end $$;

-- ============================================================================
-- Add your real services here, then run this part too.
-- Prices are in CENTS: 120.00 is 12000. Duplicate a line per service.
-- You can also add and edit these on the Services page, which is easier.
-- ============================================================================

-- insert into services (tenant_id, name, duration_minutes, buffer_after_minutes, price_cents, deposit_cents)
-- select t.id, 'Loc Retwist', 120, 15, 12000, 3000 from tenants t where t.slug = 'yoursalon';

-- After adding services by SQL, link them to you so they appear on the booking page:
-- insert into staff_services (tenant_id, staff_id, service_id)
-- select s.tenant_id, st.id, s.id
--   from services s
--   join staff st on st.tenant_id = s.tenant_id
--  where not exists (
--    select 1 from staff_services x where x.staff_id = st.id and x.service_id = s.id
--  );
