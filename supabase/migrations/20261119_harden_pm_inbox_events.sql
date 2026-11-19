-- Sprint 2 hardening for pm_inbox & pm_events (idempotent, zero PII)
-- Apply via Supabase SQL / MCP execute_sql if desired.

-- 1. Harden pm_inbox length & content constraints (NOT VALID preserves any legacy rows while validating all new writes)
do $$
begin
  if to_regclass('public.pm_inbox') is not null then
    alter table public.pm_inbox enable row level security;

    if not exists (select 1 from pg_constraint where conname = 'pm_inbox_title_len') then
      alter table public.pm_inbox
        add constraint pm_inbox_title_len check (char_length(trim(coalesce(title, ''))) between 2 and 200) not valid;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'pm_inbox_details_len') then
      alter table public.pm_inbox
        add constraint pm_inbox_details_len check (char_length(coalesce(details, '')) <= 2000) not valid;
    end if;

    if not exists (select 1 from pg_constraint where conname = 'pm_inbox_category_len') then
      alter table public.pm_inbox
        add constraint pm_inbox_category_len check (char_length(coalesce(category, '')) <= 120) not valid;
    end if;

    -- Prevent anon SELECT/UPDATE/DELETE; allow INSERT only
    revoke select, update, delete on public.pm_inbox from anon;
  end if;
end $$;

-- 2. Harden pm_events constraints (strict allowlist matching all client trackEvent() names, zero birth year / PII)
do $$
begin
  if to_regclass('public.pm_events') is not null then
    alter table public.pm_events enable row level security;

    if exists (select 1 from pg_constraint where conname = 'pm_events_event_allowlist') then
      alter table public.pm_events drop constraint pm_events_event_allowlist;
    end if;

    alter table public.pm_events
      add constraint pm_events_event_allowlist check (
        event in (
          'visit','view','timeline_started','share_link','export_png',
          'share_png_native','share_duo_native','video_play','trivia_streak',
          'roots_complete','roots_share','roots_copy','steam_import',
          'friend_match','credits_roll'
        )
      ) not valid;

    if not exists (select 1 from pg_constraint where conname = 'pm_events_section_len') then
      alter table public.pm_events
        add constraint pm_events_section_len check (char_length(coalesce(section, '')) <= 48) not valid;
    end if;

    revoke select, update, delete on public.pm_events from anon;
  end if;
end $$;
